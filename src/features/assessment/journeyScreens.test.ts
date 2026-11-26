import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { markScreenSeen, wasScreenSeen } from './journeyScreens.ts'

describe('the screens seen once', () => {
  const memory = () => {
    const data = new Map<string, string>()
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    } as unknown as Storage
  }
  it('are remembered per level and screen', () => {
    const storage = memory()
    assert.equal(wasScreenSeen(storage, 'map1', 'congrats_checkin'), false)
    markScreenSeen(storage, 'map1', 'congrats_checkin')
    assert.equal(wasScreenSeen(storage, 'map1', 'congrats_checkin'), true)
    assert.equal(wasScreenSeen(storage, 'map2', 'congrats_checkin'), false)
    assert.equal(wasScreenSeen(storage, 'map1', 'congrats_final'), false)
  })
  it('survive blocked storage by showing again, never by failing', () => {
    assert.equal(wasScreenSeen(null, 'map1', 'congrats_final'), false)
    markScreenSeen(null, 'map1', 'congrats_final')
  })
})
