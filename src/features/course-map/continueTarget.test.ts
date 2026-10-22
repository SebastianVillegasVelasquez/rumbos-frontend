import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Availability, BubbleStatus, RenderableBubble } from './data/types.ts'
import { continueTarget } from './continueTarget.ts'

const bubble = (
  id: string,
  sequence: number,
  status: BubbleStatus = 'no_complete',
  tracked = true
): RenderableBubble => ({
  id,
  activityId: sequence + 1,
  x: 0,
  y: 0,
  icon: null,
  skinId: null,
  sequence,
  status,
  ...(tracked ? {} : { tracked: false }),
})

const free = () => undefined
const by = (map: Record<string, Availability>) => (b: RenderableBubble) => map[b.id]

describe('continueTarget', () => {
  it('guided: the next bubble by sequence', () => {
    const bubbles = [bubble('a', 0, 'complete'), bubble('b', 1), bubble('c', 2)]
    assert.equal(continueTarget(bubbles, 'guided', free)?.id, 'b')
  })

  it('explorative: the first incomplete open bubble by sequence, whatever the array order', () => {
    const bubbles = [bubble('c', 2), bubble('a', 0, 'complete'), bubble('b', 1)]
    assert.equal(continueTarget(bubbles, 'explorative', free)?.id, 'b')
  })

  it('skips untracked, locked and hidden activities', () => {
    const bubbles = [bubble('a', 0, 'no_complete', false), bubble('b', 1), bubble('c', 2)]
    assert.equal(continueTarget(bubbles, 'explorative', by({ b: 'restricted' }))?.id, 'c')
    assert.equal(continueTarget(bubbles, 'explorative', by({ b: 'hidden' }))?.id, 'c')
  })

  it('does not wait for a hidden activity in guided mode', () => {
    const bubbles = [bubble('a', 0), bubble('b', 1)]
    assert.equal(continueTarget(bubbles, 'guided', by({ a: 'hidden' }))?.id, 'b')
  })

  it('offers an activity that was attempted but not passed', () => {
    const bubbles = [bubble('a', 0, 'in_progress'), bubble('b', 1)]
    assert.equal(continueTarget(bubbles, 'guided', free)?.id, 'a')
  })

  it('is null when only untracked or complete activities remain', () => {
    const bubbles = [bubble('a', 0, 'complete'), bubble('b', 1, 'no_complete', false)]
    assert.equal(continueTarget(bubbles, 'guided', free), null)
    assert.equal(continueTarget(bubbles, 'explorative', free), null)
  })

  it('is null for an empty level', () => {
    assert.equal(continueTarget([], 'guided', free), null)
  })
})
