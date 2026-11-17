import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  announcementDue,
  formatClock,
  remainingMinutes,
  remainingMs,
  syncClock,
} from './serverClock.ts'

const T0 = Date.parse('2026-11-17T10:00:00Z')

describe('server clock', () => {
  it('counts down from the server, whatever the device says', () => {
    // The device is 2 hours fast; the deadline is 60 minutes after the server's now.
    const device = T0 + 2 * 3600_000
    const clock = syncClock(
      { server_now: '2026-11-17T10:00:00Z', deadline_at: '2026-11-17T11:00:00Z' },
      device
    )!
    assert.equal(remainingMs(clock, device), 3600_000)
    assert.equal(remainingMs(clock, device + 10 * 60_000), 3000_000)
  })
  it('re-syncs on a later response and ignores drift', () => {
    const first = syncClock(
      { server_now: '2026-11-17T10:00:00Z', deadline_at: '2026-11-17T11:00:00Z' },
      T0
    )!
    // 20 min later by the server, the device only moved 19: the offset corrects it.
    const second = syncClock(
      { server_now: '2026-11-17T10:20:00Z', deadline_at: '2026-11-17T11:00:00Z' },
      T0 + 19 * 60_000
    )!
    assert.equal(remainingMs(first, T0 + 19 * 60_000), 41 * 60_000)
    assert.equal(remainingMs(second, T0 + 19 * 60_000), 40 * 60_000)
  })
  it('never goes below zero and rejects garbage', () => {
    const clock = syncClock(
      { server_now: '2026-11-17T10:00:00Z', deadline_at: '2026-11-17T10:01:00Z' },
      T0
    )!
    assert.equal(remainingMs(clock, T0 + 10 * 60_000), 0)
    assert.equal(syncClock({ server_now: 'x', deadline_at: 'y' }, T0), null)
  })
  it('announces 10, 5 and 1 minutes once each, never every second', () => {
    const min = (n: number) => n * 60_000
    assert.equal(announcementDue(min(11), min(10)), 10)
    assert.equal(announcementDue(min(10), min(9.99)), null)
    assert.equal(announcementDue(min(5.5), min(5)), 5)
    assert.equal(announcementDue(min(1.01), min(1)), 1)
    assert.equal(announcementDue(min(30), min(29)), null)
    // A resume that lands inside the last 5 minutes says the closest one, once.
    assert.equal(announcementDue(null, min(4)), 5)
    assert.equal(announcementDue(min(2), 0), null)
  })
  it('formats the clock and the minutes', () => {
    assert.equal(formatClock(61_000), '01:01')
    assert.equal(formatClock(3600_000), '1:00:00')
    assert.equal(formatClock(0), '00:00')
    assert.equal(remainingMinutes(1), 1)
    assert.equal(remainingMinutes(60_000), 1)
    assert.equal(remainingMinutes(60_001), 2)
  })
})
