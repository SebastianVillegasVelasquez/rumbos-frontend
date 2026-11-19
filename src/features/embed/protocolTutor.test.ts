import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseCapabilities, parseHostMessage, toWireMessage } from './protocol.ts'

const state = {
  schemaVersion: 1,
  courseId: 7,
  generatedAt: '2026-01-01T00:00:00Z',
  sections: [],
  activities: [],
  unavailableCmids: [],
}
const init = (extra: Record<string, unknown> = {}) =>
  parseHostMessage({
    type: 'rumbos:host-init',
    v: 1,
    mode: 'student',
    locale: 'es',
    courseId: 7,
    courseName: null,
    assertion: 'a.b.c',
    state,
    ...extra,
  })

describe('host capabilities (contract v5.10)', () => {
  it('reads the tutor flag from the handshake', () => {
    const message = init({ capabilities: { tutor: true } })
    assert.equal(message?.type === 'rumbos:host-init' && message.capabilities.tutor, true)
  })

  it('treats a host without capabilities as one without the tutor', () => {
    const message = init()
    assert.equal(message?.type === 'rumbos:host-init' && message.capabilities.tutor, false)
  })

  it('turns the tutor on only for exactly true', () => {
    for (const tutor of ['true', 1, null, {}, undefined])
      assert.equal(parseCapabilities({ tutor }).tutor, false)
    assert.equal(parseCapabilities('x').tutor, false)
    assert.equal(parseCapabilities({ tutor: true, other: 1 }).tutor, true)
  })

  it('accepts host-tutor-closed and nothing else about it', () => {
    assert.deepEqual(parseHostMessage({ type: 'rumbos:host-tutor-closed', v: 1 }), {
      type: 'rumbos:host-tutor-closed',
      v: 1,
    })
    assert.equal(parseHostMessage({ type: 'rumbos:host-tutor-closed', v: 2 }), null)
  })

  it('sends tutor-open with no URL and no payload, whatever is added to it', () => {
    const polluted = { type: 'rumbos:tutor-open', v: 1, url: 'https://evil.test' } as const
    assert.deepEqual(toWireMessage(polluted), { type: 'rumbos:tutor-open', v: 1 })
  })
})
