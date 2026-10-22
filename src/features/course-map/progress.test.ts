import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Availability, BubbleStatus, RenderableBubble } from './data/types.ts'
import { countsTowardProgress, progressCounts } from './progress.ts'
import { nextIncompleteSequence } from './visualState.ts'

const bubble = (
  id: string,
  status: BubbleStatus,
  sequence: number,
  tracked?: boolean
): RenderableBubble => ({
  id,
  activityId: sequence + 1,
  x: 0,
  y: 0,
  icon: null,
  skinId: null,
  sequence,
  status,
  ...(tracked === false ? { tracked } : {}),
})

const availabilityOf =
  (map: Record<string, Availability> = {}) =>
  (b: RenderableBubble) =>
    map[b.id]

describe('progressCounts', () => {
  it('counts tracked activities only', () => {
    const counts = progressCounts(
      [
        bubble('a', 'complete', 0),
        bubble('b', 'no_complete', 1),
        bubble('c', 'no_complete', 2, false),
        bubble('d', 'no_complete', 3, false),
      ],
      availabilityOf()
    )
    assert.deepEqual(
      [counts.total, counts.completed, counts.untracked, counts.percent],
      [2, 1, 2, 50]
    )
    assert.equal(counts.allComplete, false)
    assert.equal(counts.nothingTracked, false)
  })

  it('says nothing is tracked instead of 0 of 0', () => {
    const counts = progressCounts(
      [bubble('a', 'no_complete', 0, false), bubble('b', 'no_complete', 1, false)],
      availabilityOf()
    )
    assert.equal(counts.total, 0)
    assert.equal(counts.percent, null)
    assert.equal(counts.nothingTracked, true)
    assert.equal(counts.allComplete, false)
  })

  it('an empty level is not "nothing tracked"', () => {
    const counts = progressCounts([], availabilityOf())
    assert.equal(counts.nothingTracked, false)
    assert.equal(counts.percent, null)
  })

  it('is complete once every tracked activity is, ignoring untracked ones', () => {
    const counts = progressCounts(
      [bubble('a', 'complete', 0), bubble('b', 'no_complete', 1, false)],
      availabilityOf()
    )
    assert.equal(counts.allComplete, true)
    assert.equal(counts.percent, 100)
  })

  it('leaves out what a student cannot see, but not what an editor can', () => {
    const bubbles = [
      bubble('a', 'complete', 0),
      bubble('b', 'no_complete', 1),
      bubble('c', 'no_complete', 2),
    ]
    const availability = availabilityOf({ b: 'hidden', c: 'missing' })
    const student = progressCounts(bubbles, availability, 'student')
    assert.deepEqual([student.total, student.completed], [1, 1])
    const editor = progressCounts(bubbles, availability, 'editor')
    assert.deepEqual([editor.total, editor.completed], [2, 1], 'missing never counts')
  })

  it('keeps restricted and unknown activities in the fraction', () => {
    const counts = progressCounts(
      [bubble('a', 'no_complete', 0), bubble('b', 'no_complete', 1)],
      availabilityOf({ a: 'restricted', b: 'unknown' })
    )
    assert.equal(counts.total, 2)
  })
})

describe('countsTowardProgress', () => {
  it('follows the same rules', () => {
    const tracked = bubble('a', 'no_complete', 0)
    const untracked = bubble('b', 'no_complete', 1, false)
    assert.equal(countsTowardProgress(tracked, 'available', 'student'), true)
    assert.equal(countsTowardProgress(untracked, 'available', 'student'), false)
    assert.equal(countsTowardProgress(tracked, 'hidden', 'student'), false)
    assert.equal(countsTowardProgress(tracked, 'hidden', 'editor'), true)
    assert.equal(countsTowardProgress(tracked, 'missing', 'editor'), false)
  })
})

describe('nextIncompleteSequence with untracked and unseen bubbles', () => {
  it('skips untracked bubbles', () => {
    assert.equal(
      nextIncompleteSequence([bubble('a', 'no_complete', 0, false), bubble('b', 'no_complete', 1)]),
      1
    )
  })

  it('is null when only untracked bubbles are left', () => {
    assert.equal(
      nextIncompleteSequence([bubble('a', 'complete', 0), bubble('b', 'no_complete', 1, false)]),
      null
    )
  })

  it('does not wait for a bubble the student cannot see', () => {
    const bubbles = [bubble('a', 'no_complete', 0), bubble('b', 'no_complete', 1)]
    const availability = availabilityOf({ a: 'hidden' })
    assert.equal(
      nextIncompleteSequence(bubbles, (b) => countsTowardProgress(b, availability(b), 'student')),
      1
    )
  })
})
