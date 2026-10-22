import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { newlyCompleted, snapshotOf } from './completionChanges.ts'

const snap = (entries: [number, boolean][]) => new Map(entries)

describe('newlyCompleted', () => {
  it('never fires for the first state', () => {
    assert.deepEqual(newlyCompleted(null, snap([[1, true]])), [])
  })

  it('fires for a not-complete to complete transition', () => {
    assert.deepEqual(newlyCompleted(snap([[1, false]]), snap([[1, true]])), [1])
  })

  it('does not fire twice for the same transition', () => {
    const before = snap([[1, false]])
    const after = snap([[1, true]])
    assert.deepEqual(newlyCompleted(before, after), [1])
    assert.deepEqual(newlyCompleted(after, after), [])
  })

  it('fires again if the completion is undone and redone', () => {
    const a = snap([[1, true]])
    const b = snap([[1, false]])
    assert.deepEqual(newlyCompleted(a, b), [])
    assert.deepEqual(newlyCompleted(b, a), [1])
  })

  it('ignores activities that were already complete or just appeared', () => {
    assert.deepEqual(
      newlyCompleted(
        snap([[1, true]]),
        snap([
          [1, true],
          [2, true],
        ])
      ),
      []
    )
  })

  it('ignores unrelated changes and un-completions', () => {
    assert.deepEqual(
      newlyCompleted(
        snap([
          [1, true],
          [2, false],
        ]),
        snap([
          [1, false],
          [2, false],
        ])
      ),
      []
    )
  })

  it('reports several at once, in state order', () => {
    assert.deepEqual(
      newlyCompleted(
        snap([
          [1, false],
          [2, false],
          [3, true],
        ]),
        snap([
          [1, true],
          [2, true],
          [3, true],
        ])
      ),
      [1, 2]
    )
  })
})

describe('snapshotOf', () => {
  it('maps cmid to complete', () => {
    const bubble = { id: 'a', activityId: 7, x: 0, y: 0, icon: null, skinId: null, sequence: 0 }
    const result = snapshotOf([
      { ...bubble, status: 'complete' },
      { ...bubble, id: 'b', activityId: 8, status: 'no_complete', tracked: false },
    ])
    assert.deepEqual(
      [...result],
      [
        [7, true],
        [8, false],
      ]
    )
  })
})
