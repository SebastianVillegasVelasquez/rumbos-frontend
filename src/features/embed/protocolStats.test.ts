import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseCourseStats, parseHostMessage, toWireMessage } from './protocol.ts'

const stats = {
  schemaVersion: 1,
  generatedAt: '2026-01-01T00:00:00Z',
  courseId: 7,
  groupId: 0,
  groups: [{ id: 3, name: 'Grupo A' }],
  tracked: 19,
  minCohort: 5,
  suppressed: false,
  activities: [
    { cmid: 11, completionTracked: true, complete: 12, failed: 3 },
    { cmid: 12, completionTracked: false, complete: 0, failed: 0 },
  ],
}

describe('host-stats', () => {
  it('accepts a well-formed message', () => {
    const message = parseHostMessage({ type: 'rumbos:host-stats', v: 1, stats })
    assert.equal(message?.type, 'rumbos:host-stats')
    assert.equal(message?.type === 'rumbos:host-stats' && message.stats?.activities.length, 2)
  })

  it('accepts the two error answers and nothing else', () => {
    for (const error of ['capability', 'unavailable'])
      assert.deepEqual(parseHostMessage({ type: 'rumbos:host-stats', v: 1, error }), {
        type: 'rumbos:host-stats',
        v: 1,
        stats: null,
        error,
      })
    assert.equal(parseHostMessage({ type: 'rumbos:host-stats', v: 1, error: 'boom' }), null)
    assert.equal(parseHostMessage({ type: 'rumbos:host-stats', v: 1 }), null)
    assert.equal(parseHostMessage({ type: 'rumbos:host-stats', v: 2, stats }), null)
  })

  it('drops the counts of suppressed stats', () => {
    const parsed = parseCourseStats({ ...stats, suppressed: true, tracked: 2 })
    assert.equal(parsed?.suppressed, true)
    assert.deepEqual(parsed?.activities, [])
  })

  it('rejects impossible numbers', () => {
    const bad = (activity: object) =>
      parseCourseStats({ ...stats, activities: [{ ...stats.activities[0], ...activity }] })
    assert.equal(bad({ complete: 20 }), null)
    assert.equal(bad({ failed: 20 }), null)
    assert.equal(bad({ complete: -1 }), null)
    assert.equal(bad({ complete: 1.5 }), null)
    assert.equal(bad({ cmid: 0 }), null)
    assert.equal(bad({ completionTracked: 'yes' }), null)
    assert.equal(parseCourseStats({ ...stats, tracked: -1 }), null)
    assert.equal(parseCourseStats({ ...stats, suppressed: 'no' }), null)
    assert.equal(parseCourseStats({ ...stats, schemaVersion: 2 }), null)
  })

  it('keeps the first of a repeated cmid', () => {
    const parsed = parseCourseStats({
      ...stats,
      activities: [stats.activities[0], { ...stats.activities[0], complete: 1 }],
    })
    assert.equal(parsed?.activities.length, 1)
    assert.equal(parsed?.activities[0].complete, 12)
  })

  it('puts only a valid group id on the wire', () => {
    assert.deepEqual(toWireMessage({ type: 'rumbos:request-stats', v: 1, groupId: 3 }), {
      type: 'rumbos:request-stats',
      v: 1,
      groupId: 3,
    })
    assert.deepEqual(toWireMessage({ type: 'rumbos:request-stats', v: 1, groupId: -2 }), {
      type: 'rumbos:request-stats',
      v: 1,
    })
    assert.deepEqual(toWireMessage({ type: 'rumbos:request-stats', v: 1 }), {
      type: 'rumbos:request-stats',
      v: 1,
    })
  })
})
