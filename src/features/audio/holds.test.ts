import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createHolds } from './holds.ts'

describe('ambient music holds', () => {
  it('stays held until the last holder lets go', () => {
    const seen: boolean[] = []
    const holds = createHolds((held) => seen.push(held))
    const a = holds.acquire()
    const b = holds.acquire()
    holds.setSwitch(true)
    a()
    assert.equal(holds.held(), true)
    holds.setSwitch(false)
    assert.equal(holds.held(), true)
    b()
    assert.equal(holds.held(), false)
    assert.equal(seen.at(-1), false)
  })
  it('releasing twice does not release someone else', () => {
    const holds = createHolds(() => undefined)
    const a = holds.acquire()
    holds.acquire()
    a()
    a()
    assert.equal(holds.held(), true)
  })
  it('the curtain closing frees the switch but not a playing clip', () => {
    const holds = createHolds(() => undefined)
    holds.setSwitch(true)
    const clip = holds.acquire()
    holds.resetSwitch()
    assert.equal(holds.held(), true)
    clip()
    assert.equal(holds.held(), false)
  })
})
