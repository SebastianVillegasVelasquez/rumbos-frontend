import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type {
  Activity,
  Availability,
  BubbleStatus,
  RenderableBubble,
} from '../course-map/data/types.ts'
import { buildQuestEntries } from './questEntries.ts'

const bubble = (
  id: string,
  sequence: number,
  status: BubbleStatus = 'no_complete',
  tracked = true
): RenderableBubble => ({
  id,
  activityId: sequence + 100,
  x: 0,
  y: 0,
  icon: null,
  skinId: null,
  sequence,
  status,
  ...(tracked ? {} : { tracked: false }),
})

const activity = (b: RenderableBubble, extra: Partial<Activity> = {}): Activity => ({
  activityId: b.activityId as number,
  name: `Actividad ${b.id}`,
  modname: 'quiz',
  url: '',
  sectionId: 1,
  sectionName: '',
  sectionNumber: 1,
  hidden: false,
  placed: true,
  bubbleId: b.id,
  placedInMapId: 'm',
  ...extra,
})

const run = (
  bubbles: RenderableBubble[],
  availability: Record<string, Availability> = {},
  mode: 'guided' | 'explorative' = 'guided',
  info: Record<string, string> = {}
) =>
  buildQuestEntries({
    bubbles,
    mode,
    availabilityOf: (b) => availability[b.id] ?? 'available',
    activityOf: (b) => activity(b, { availabilityInfo: info[b.id] ?? null }),
  })

const ids = (entries: { bubbleId: string }[]) => entries.map((e) => e.bubbleId)

describe('buildQuestEntries', () => {
  it('groups a guided level: next, locked and complete', () => {
    const groups = run([bubble('a', 0, 'complete'), bubble('b', 1), bubble('c', 2)])
    assert.deepEqual(ids(groups.complete), ['a'])
    assert.deepEqual(ids(groups.next), ['b'])
    assert.deepEqual(ids(groups.locked), ['c'])
    assert.deepEqual(groups.available, [])
  })

  it('explorative: the first open one is next, the rest are available', () => {
    const groups = run([bubble('b', 1), bubble('a', 0), bubble('c', 2)], {}, 'explorative')
    assert.deepEqual(ids(groups.next), ['a'])
    assert.deepEqual(ids(groups.available), ['b', 'c'])
  })

  it('never reveals the name of a hidden activity', () => {
    const groups = run([bubble('a', 0), bubble('b', 1)], { a: 'hidden' })
    assert.deepEqual(ids(groups.upcoming), ['a'])
    assert.equal(groups.upcoming[0].name, null)
    assert.equal(groups.upcoming[0].openable, false)
    assert.equal(JSON.stringify(groups).includes('Actividad a'), false)
  })

  it('shows the restriction text only on restricted activities', () => {
    const groups = run([bubble('a', 0), bubble('b', 1)], { a: 'restricted' }, 'explorative', {
      a: 'Disponible desde el lunes',
      b: 'no debería verse',
    })
    assert.equal(groups.locked[0].info, 'Disponible desde el lunes')
    assert.equal(groups.next[0].info, null)
  })

  it('lists untracked activities as available and openable, never next', () => {
    const groups = run([bubble('a', 0, 'no_complete', false), bubble('b', 1)], {}, 'explorative')
    assert.deepEqual(ids(groups.next), ['b'])
    assert.equal(groups.available[0].state, 'untracked')
    assert.equal(groups.available[0].openable, true)
  })

  it('puts missing and unverifiable activities with the blocked ones', () => {
    const groups = run([bubble('a', 0), bubble('b', 1)], { a: 'missing', b: 'unknown' })
    assert.deepEqual(ids(groups.locked), ['a', 'b'])
    assert.equal(
      groups.locked.every((e) => !e.openable),
      true
    )
  })

  it('orders each group by sequence', () => {
    const groups = run(
      [bubble('z', 5, 'complete'), bubble('y', 1, 'complete'), bubble('x', 3, 'complete')],
      {},
      'explorative'
    )
    assert.deepEqual(ids(groups.complete), ['y', 'x', 'z'])
  })

  it('has nothing next when everything is done', () => {
    const groups = run([bubble('a', 0, 'complete')])
    assert.deepEqual(groups.next, [])
  })
})
