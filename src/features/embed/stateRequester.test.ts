import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createStateRequester } from './stateRequester.ts'

// A manual clock: timers fire only when advance() passes them.
const harness = () => {
  let time = 100_000
  let received = 0
  let sent = 0
  const timers = new Map<number, { at: number; run: () => void }>()
  let nextId = 0
  const requester = createStateRequester({
    send: () => void sent++,
    now: () => time,
    receivedCount: () => received,
    schedule: (run, delay) => {
      const id = nextId++
      timers.set(id, { at: time + delay, run })
      return () => void timers.delete(id)
    },
  })
  const advance = (ms: number) => {
    const target = time + ms
    for (;;) {
      const due = [...timers.entries()]
        .filter(([, t]) => t.at <= target)
        .sort((a, b) => a[1].at - b[1].at)[0]
      if (!due) break
      timers.delete(due[0])
      time = due[1].at
      due[1].run()
    }
    time = target
  }
  return {
    requester,
    advance,
    sent: () => sent,
    stateArrived: () => void received++,
  }
}

describe('createStateRequester', () => {
  it('sends the first request at once', () => {
    const h = harness()
    h.requester.request()
    assert.equal(h.sent(), 1)
  })

  it('defers a request inside the gap to its end instead of dropping it', () => {
    const h = harness()
    h.requester.request()
    h.advance(1_000)
    h.requester.request()
    assert.equal(h.sent(), 1)
    h.advance(1_999)
    assert.equal(h.sent(), 1)
    h.advance(1)
    assert.equal(h.sent(), 2)
  })

  it('coalesces a burst into one trailing send', () => {
    const h = harness()
    h.requester.request()
    for (let i = 0; i < 5; i++) h.requester.request()
    h.advance(10_000)
    assert.equal(h.sent(), 2)
  })

  it('does not ask after an overlay closes when the host already refreshed', () => {
    const h = harness()
    h.requester.afterOverlayClosed()
    h.advance(500)
    h.stateArrived()
    h.advance(5_000)
    assert.equal(h.sent(), 0)
  })

  it('asks once after an overlay closes when nothing arrives', () => {
    const h = harness()
    h.requester.afterOverlayClosed()
    h.advance(1_499)
    assert.equal(h.sent(), 0)
    h.advance(1)
    assert.equal(h.sent(), 1)
    h.advance(30_000)
    assert.equal(h.sent(), 1)
  })

  it('a second close restarts the wait rather than stacking retries', () => {
    const h = harness()
    h.requester.afterOverlayClosed()
    h.advance(1_000)
    h.requester.afterOverlayClosed()
    h.advance(1_400)
    assert.equal(h.sent(), 0)
    h.advance(100)
    assert.equal(h.sent(), 1)
  })

  it('dispose cancels what is pending', () => {
    const h = harness()
    h.requester.request()
    h.requester.request()
    h.requester.afterOverlayClosed()
    h.requester.dispose()
    h.advance(10_000)
    assert.equal(h.sent(), 1)
  })
})
