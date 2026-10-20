import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { isHostOverlayOpen, setHostOverlayOpen, subscribeHostOverlay } from './hostOverlay.ts'
import { parseHostMessage } from './protocol.ts'

describe('rumbos:host-overlay', () => {
  it('parses open and close', () => {
    assert.deepEqual(parseHostMessage({ type: 'rumbos:host-overlay', v: 1, open: true }), {
      type: 'rumbos:host-overlay',
      v: 1,
      open: true,
    })
    assert.deepEqual(parseHostMessage({ type: 'rumbos:host-overlay', v: 1, open: false }), {
      type: 'rumbos:host-overlay',
      v: 1,
      open: false,
    })
  })

  it('rejects a wrong version or shape', () => {
    for (const bad of [
      { type: 'rumbos:host-overlay', v: 2, open: true },
      { type: 'rumbos:host-overlay', open: true },
      { type: 'rumbos:host-overlay', v: 1 },
      { type: 'rumbos:host-overlay', v: 1, open: 'yes' },
      { type: 'rumbos:host-overlay', v: 1, open: 1 },
    ]) {
      assert.equal(parseHostMessage(bad), null, JSON.stringify(bad))
    }
  })
})

describe('host overlay store', () => {
  afterEach(() => setHostOverlayOpen(false))

  it('notifies only on a change', () => {
    let calls = 0
    const stop = subscribeHostOverlay(() => calls++)
    setHostOverlayOpen(true)
    setHostOverlayOpen(true)
    assert.equal(isHostOverlayOpen(), true)
    setHostOverlayOpen(false)
    stop()
    setHostOverlayOpen(true)
    assert.equal(calls, 2)
  })
})
