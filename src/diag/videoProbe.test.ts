import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { MAX_PROBE_LINES, describeMessage, formatLine, formatLog, pushLine } from './videoProbe.ts'

describe('what a player message is called in the log', () => {
  it('names the signals we understand', () => {
    assert.equal(describeMessage('youtube', '{"event":"onReady"}'), 'ready (onReady)')
    assert.equal(
      describeMessage('youtube', { event: 'onStateChange', info: 0 }),
      'ended (onStateChange)'
    )
    assert.equal(describeMessage('vimeo', { event: 'play' }), 'playing (play)')
    assert.equal(describeMessage('vimeo', { event: 'finish' }), 'ended (finish)')
    assert.equal(describeMessage('vimeo', { event: 'error', data: {} }), 'error')
  })
  it('shows an unknown event by name instead of dropping it, and sanitizes it', () => {
    assert.equal(describeMessage('youtube', { event: 'initialDelivery' }), 'other: initialDelivery')
    assert.equal(describeMessage('youtube', { event: 'a<b>c d' }), 'other: a?b?c?d')
    assert.equal(
      describeMessage('vimeo', { event: 'x'.repeat(100) })?.length,
      'other: '.length + 40
    )
  })
  it('says nothing about what is not a player message', () => {
    for (const data of ['hello', 7, null, [], { nothing: 1 }])
      assert.equal(describeMessage('youtube', data), null)
  })
})

describe('the log', () => {
  it('is bounded', () => {
    let lines: ReturnType<typeof pushLine> = []
    for (let i = 0; i < MAX_PROBE_LINES + 50; i++)
      lines = pushLine(lines, { at: i, label: String(i) })
    assert.equal(lines.length, MAX_PROBE_LINES)
    assert.equal(lines.at(-1)?.label, String(MAX_PROBE_LINES + 49))
  })
  it('formats a line with the clock and the seconds since the click', () => {
    const start = new Date(2026, 0, 1, 14, 3, 5, 0).getTime()
    assert.equal(
      formatLine({ at: start + 1800, label: 'ready' }, start),
      '14:03:06.800 (+1.8 s) ready'
    )
  })
  it('the copied text says the provider, the video, the browser and every line', () => {
    const start = 0
    const text = formatLog('vimeo', '76979871', start, [{ at: 0, label: 'click' }], 'Safari 17')
    assert.match(text, /^Provider: vimeo {2}Video: 76979871\nBrowser: Safari 17\n/)
    assert.match(text, /click$/)
  })
})
