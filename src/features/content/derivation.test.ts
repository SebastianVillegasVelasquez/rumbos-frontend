import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { continueTarget } from '../course-map/continueTarget.ts'
import type { RenderableBubble } from '../course-map/data/types.ts'
import { progressCounts } from '../course-map/progress.ts'
import { nextIncompleteSequence } from '../course-map/visualState.ts'
import { applyHostStatus, indexCourseState, resolveHostBubbles } from '../embed/hostDerivation.ts'
import { buildQuestEntries } from '../quests/questEntries.ts'

const activity = (id: string, sequence: number, activityId: number): RenderableBubble => ({
  id,
  kind: 'activity',
  activityId,
  x: 0,
  y: 0,
  icon: null,
  skinId: null,
  sequence,
  status: 'no_complete',
})

const info = (id: string, sequence: number): RenderableBubble => ({
  id,
  kind: 'content',
  activityId: null,
  content: {
    type: 'blocks',
    title: 'Introducción',
    autoOpen: 'first_visit',
    body: { schemaVersion: 1, blocks: [] },
  },
  x: 0,
  y: 0,
  icon: null,
  skinId: null,
  sequence,
  status: 'no_complete',
})

const available = () => 'available' as const

describe('content bubbles in the derivation', () => {
  it('never count toward progress, even alone', () => {
    const counts = progressCounts([info('i', 0), activity('a', 1, 11)], available)
    assert.equal(counts.total, 1)
    assert.equal(counts.untracked, 0)
    const onlyInfo = progressCounts([info('i', 0)], available)
    assert.equal(onlyInfo.total, 0)
    assert.equal(onlyInfo.nothingTracked, false)
  })

  it('are never the next bubble nor the target of Continuar', () => {
    const bubbles = [info('i', 0), activity('a', 1, 11)]
    assert.equal(continueTarget(bubbles, 'guided', available)?.id, 'a')
    assert.equal(continueTarget([info('i', 0)], 'explorative', available), null)
    assert.equal(
      nextIncompleteSequence(bubbles, (b) => b.kind !== 'content'),
      1
    )
  })

  it('show in the quest log under Información, apart from activities', () => {
    const groups = buildQuestEntries({
      bubbles: [info('i', 0), activity('a', 1, 11)],
      mode: 'guided',
      availabilityOf: available,
      activityOf: () => null,
      seenOf: (b) => b.id === 'i',
    })
    assert.deepEqual(
      groups.info.map((e) => [e.bubbleId, e.name, e.seen, e.openable]),
      [['i', 'Introducción', true, true]]
    )
    assert.deepEqual(
      groups.next.map((e) => e.bubbleId),
      ['a']
    )
  })

  it('are left alone by the host derivation', () => {
    const index = indexCourseState({
      schemaVersion: 1,
      courseId: 1,
      generatedAt: '',
      sections: [],
      activities: [],
      unavailableCmids: [],
    })
    const bubbles = [info('i', 0)]
    assert.equal(applyHostStatus(index, bubbles)[0], bubbles[0])
    assert.deepEqual(resolveHostBubbles(index, bubbles, 'm', false), [
      { bubbleId: 'i', availability: 'available', activity: null },
    ])
  })
})
