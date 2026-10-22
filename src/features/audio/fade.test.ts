import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { FADE_MS, fadeStep } from './fade.ts'

describe('fadeStep', () => {
  it('takes about 400 ms for a full sweep', () => {
    assert.equal(FADE_MS, 400)
    let level = 0
    for (let elapsed = 0; elapsed < FADE_MS; elapsed += 16) level = fadeStep(level, 1, 16)
    assert.ok(level >= 0.95)
    assert.equal(fadeStep(0, 1, FADE_MS), 1)
  })

  it('fades down as well, and stops at the target', () => {
    assert.equal(fadeStep(0.4, 0, 1000), 0)
    assert.equal(fadeStep(0.2, 0.4, 1000), 0.4)
    assert.equal(fadeStep(0.4, 0.4, 16), 0.4)
  })

  it('ignores a negative time step', () => {
    assert.equal(fadeStep(0.3, 1, -50), 0.3)
  })
})
