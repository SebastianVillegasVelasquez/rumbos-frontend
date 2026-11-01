import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { clearHostStats, getHostStats, setHostStatsResult } from '../embed/hostStats.ts'
import { SILENCE_MS, createStatsController } from './statsController.ts'

const harness = () => {
  const sent: (number | undefined)[] = []
  const timers: { run: () => void; delay: number; live: boolean }[] = []
  const controller = createStatsController({
    send: (groupId) => sent.push(groupId),
    schedule: (run, delay) => {
      const timer = { run, delay, live: true }
      timers.push(timer)
      return () => {
        timer.live = false
      }
    },
  })
  const fire = () => timers.filter((t) => t.live).forEach((t) => t.run())
  return { controller, sent, timers, fire }
}

const stats = {
  schemaVersion: 1 as const,
  generatedAt: '2026-01-01T00:00:00Z',
  courseId: 7,
  groupId: 0,
  groups: [],
  tracked: 10,
  minCohort: 5,
  suppressed: false,
  activities: [],
}

afterEach(() => clearHostStats())

describe('stats controller', () => {
  it('goes to "silent" when the host never answers', () => {
    const { controller, sent, timers, fire } = harness()
    controller.request()
    assert.equal(getHostStats().status, 'loading')
    assert.equal(timers[0].delay, SILENCE_MS)
    fire()
    assert.equal(getHostStats().status, 'silent')
    assert.deepEqual(sent, [undefined])
  })

  it('does not go silent once the host answered', () => {
    const { controller, fire } = harness()
    controller.request()
    setHostStatsResult({ stats, error: null })
    fire()
    assert.equal(getHostStats().status, 'ready')
  })

  it('keeps the numbers on screen when a refresh gets no answer', () => {
    const { controller, fire } = harness()
    controller.request()
    setHostStatsResult({ stats, error: null })
    controller.refresh()
    assert.equal(getHostStats().status, 'loading')
    fire()
    assert.equal(getHostStats().status, 'loading')
  })

  it('refreshes for the same group', () => {
    const { controller, sent } = harness()
    controller.request(4)
    controller.refresh()
    assert.deepEqual(sent, [4, 4])
  })

  it('drops everything on stop', () => {
    const { controller, timers } = harness()
    controller.request(2)
    setHostStatsResult({ stats, error: null })
    controller.stop()
    assert.equal(getHostStats().status, 'idle')
    assert.ok(timers.every((t) => !t.live))
  })
})
