import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createHostReports } from './hostReports.ts'
import { toWireMessage, type AppMessage } from './protocol.ts'

const harness = () => {
  const sent: AppMessage[] = []
  return { sent, reports: createHostReports((message) => sent.push(message)) }
}

describe('createHostReports', () => {
  it('tells the host about each no-content reason once', () => {
    const { sent, reports } = harness()
    reports.noContent('empty_map')
    reports.noContent('empty_map')
    reports.noContent('no_saved_map')
    assert.deepEqual(sent, [
      { type: 'rumbos:no-content', v: 1, reason: 'empty_map' },
      { type: 'rumbos:no-content', v: 1, reason: 'no_saved_map' },
    ])
  })

  it('sends a preferred size only when it changes', () => {
    const { sent, reports } = harness()
    reports.preferredSize(16 / 9)
    reports.preferredSize(16 / 9)
    reports.preferredSize(1.7777)
    reports.preferredSize(1)
    assert.equal(sent.length, 2)
  })

  it('clamps to 0.5..4 and ignores nonsense', () => {
    const { sent, reports } = harness()
    reports.preferredSize(9)
    reports.preferredSize(0.1)
    reports.preferredSize(Number.NaN)
    reports.preferredSize(-2)
    assert.deepEqual(
      sent.map((m) => (m.type === 'rumbos:preferred-size' ? m.aspectRatio : null)),
      [4, 0.5]
    )
  })
})

describe('toWireMessage for v5.5', () => {
  it('passes no-content through and drops an unusable size', () => {
    const noContent: AppMessage = { type: 'rumbos:no-content', v: 1, reason: 'empty_map' }
    assert.deepEqual(toWireMessage(noContent), noContent)
    assert.equal(toWireMessage({ type: 'rumbos:preferred-size', v: 1, aspectRatio: 0 }), null)
    assert.deepEqual(toWireMessage({ type: 'rumbos:preferred-size', v: 1, aspectRatio: 10 }), {
      type: 'rumbos:preferred-size',
      v: 1,
      aspectRatio: 4,
    })
  })
})
