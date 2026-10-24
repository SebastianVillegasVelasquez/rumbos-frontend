import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { computeInsets } from './insets.ts'

const stage = { left: 0, top: 0, right: 400, bottom: 800 }

describe('computeInsets', () => {
  it('measures how far each edge control reaches into the stage', () => {
    const insets = computeInsets(stage, [
      { edge: 'top', box: { left: 8, top: 8, right: 100, bottom: 52 } },
      { edge: 'right', box: { left: 348, top: 500, right: 392, bottom: 792 } },
      { edge: 'bottom', box: { left: 8, top: 748, right: 150, bottom: 792 } },
      { edge: 'bottom', box: { left: 100, top: 740.2, right: 300, bottom: 792 } },
    ])
    assert.deepEqual(insets, { top: 52, right: 52, bottom: 60, left: 0 })
  })

  it('works from a stage that is not at the origin', () => {
    const offset = { left: 100, top: 50, right: 500, bottom: 850 }
    const insets = computeInsets(offset, [
      { edge: 'left', box: { left: 108, top: 300, right: 340, bottom: 344 } },
    ])
    assert.equal(insets.left, 240)
  })

  it('ignores empty boxes (hidden or removed controls)', () => {
    const insets = computeInsets(stage, [
      { edge: 'top', box: { left: 0, top: 0, right: 0, bottom: 0 } },
    ])
    assert.deepEqual(insets, { top: 0, right: 0, bottom: 0, left: 0 })
  })
})
