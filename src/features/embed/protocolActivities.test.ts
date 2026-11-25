import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { NO_CAPABILITIES, parseCapabilities, parseHostMessage, toWireMessage } from './protocol.ts'

// Contract v5.11 (plugin docs/HOST-CONTRACT.md): the activities a flow step may show.

const host = (message: object) => parseHostMessage({ v: 1, ...message })

describe('the capabilities of v5.11', () => {
  it('read false unless exactly true', () => {
    assert.deepEqual(parseCapabilities({ activities: true, activity: true }), {
      tutor: false,
      activities: true,
      activity: true,
    })
    assert.deepEqual(parseCapabilities({ activities: 'yes', activity: 1 }), NO_CAPABILITIES)
    assert.deepEqual(parseCapabilities(undefined), NO_CAPABILITIES)
  })
})

describe('rumbos:host-activities', () => {
  const item = { cmid: 41, name: 'Guía de inicio', modname: 'resource', visible: true }
  it('carries the list', () => {
    assert.deepEqual(host({ type: 'rumbos:host-activities', items: [item] }), {
      type: 'rumbos:host-activities',
      v: 1,
      items: [item],
    })
  })
  it('carries the two errors, and nothing else', () => {
    for (const error of ['capability', 'unavailable'])
      assert.deepEqual(host({ type: 'rumbos:host-activities', error }), {
        type: 'rumbos:host-activities',
        v: 1,
        error,
      })
    assert.equal(host({ type: 'rumbos:host-activities', error: 'teapot' }), null)
  })
  it('drops the whole answer when one item is malformed', () => {
    for (const bad of [
      { ...item, cmid: 0 },
      { ...item, cmid: '41' },
      { ...item, visible: 'true' },
      { ...item, name: 7 },
    ])
      assert.equal(host({ type: 'rumbos:host-activities', items: [item, bad] }), null)
    assert.equal(host({ type: 'rumbos:host-activities' }), null)
  })
  it('keeps the name as text, cut and cleaned', () => {
    const parsed = host({
      type: 'rumbos:host-activities',
      items: [{ ...item, name: `<img src=x onerror=alert(1)>\u0000${'a'.repeat(400)}` }],
    })
    const items = parsed?.type === 'rumbos:host-activities' ? parsed.items : undefined
    const name = items?.[0].name ?? ''
    assert.ok(name.length <= 255)
    assert.ok(name.startsWith('<img'), 'markup stays as text for React to escape')
    assert.ok(!name.includes('\u0000'))
  })
  it('refuses a list longer than the app can show', () => {
    assert.equal(
      host({ type: 'rumbos:host-activities', items: Array.from({ length: 501 }, () => item) }),
      null
    )
  })
})

describe('the activity open answers', () => {
  it('opened and closed name the cmid', () => {
    assert.deepEqual(host({ type: 'rumbos:host-activity-opened', cmid: 41 }), {
      type: 'rumbos:host-activity-opened',
      v: 1,
      cmid: 41,
    })
    assert.deepEqual(host({ type: 'rumbos:host-activity-closed', cmid: 41 }), {
      type: 'rumbos:host-activity-closed',
      v: 1,
      cmid: 41,
    })
    for (const type of ['rumbos:host-activity-opened', 'rumbos:host-activity-closed'])
      for (const cmid of [0, -1, 1.5, '41', undefined]) assert.equal(host({ type, cmid }), null)
  })
  it('failed carries the three reasons; a newer one reads as not found', () => {
    for (const reason of ['not_found', 'forbidden', 'unsupported'])
      assert.deepEqual(host({ type: 'rumbos:host-activity-open-failed', cmid: 41, reason }), {
        type: 'rumbos:host-activity-open-failed',
        v: 1,
        cmid: 41,
        reason,
      })
    const unknown = host({ type: 'rumbos:host-activity-open-failed', cmid: 41, reason: 'later' })
    assert.equal(unknown && 'reason' in unknown ? unknown.reason : null, 'not_found')
    assert.equal(host({ type: 'rumbos:host-activity-open-failed', reason: 'forbidden' }), null)
  })
})

describe('what the app sends for activities', () => {
  it('asks for the list with no fields', () => {
    assert.deepEqual(toWireMessage({ type: 'rumbos:request-activities', v: 1 }), {
      type: 'rumbos:request-activities',
      v: 1,
    })
  })
  it('opens by cmid and never lets anything else through, a URL included', () => {
    const hostile = {
      type: 'rumbos:activity-open',
      v: 1,
      cmid: 41,
      url: 'https://evil.example/',
      href: 'javascript:alert(1)',
    } as unknown as Parameters<typeof toWireMessage>[0]
    assert.deepEqual(toWireMessage(hostile), { type: 'rumbos:activity-open', v: 1, cmid: 41 })
  })
  it('does not send an id that is not a positive integer', () => {
    for (const cmid of [0, -3, 2.5, Number.NaN, Number.MAX_SAFE_INTEGER + 2])
      assert.equal(toWireMessage({ type: 'rumbos:activity-open', v: 1, cmid }), null)
  })
})
