import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { startReadyRetry } from './readyRetry.ts'

describe('startReadyRetry', () => {
  it('sends at once, then every 500 ms', (t) => {
    t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] })
    let sent = 0
    const stop = startReadyRetry(() => sent++)
    assert.equal(sent, 1)
    t.mock.timers.tick(499)
    assert.equal(sent, 1)
    t.mock.timers.tick(1)
    assert.equal(sent, 2)
    t.mock.timers.tick(1000)
    assert.equal(sent, 4)
    stop()
  })

  it('stops when told to (host-init arrived)', (t) => {
    t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] })
    let sent = 0
    const stop = startReadyRetry(() => sent++)
    t.mock.timers.tick(1000)
    stop()
    const atStop = sent
    t.mock.timers.tick(20_000)
    assert.equal(sent, atStop)
  })

  it('gives up after 10 s without an answer', (t) => {
    t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] })
    let sent = 0
    startReadyRetry(() => sent++)
    t.mock.timers.tick(10_000)
    const atLimit = sent
    assert.equal(atLimit, 20)
    t.mock.timers.tick(30_000)
    assert.equal(sent, atLimit)
  })
})
