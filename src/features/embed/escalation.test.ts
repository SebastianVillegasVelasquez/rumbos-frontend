import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { classifyFeatureError, escalatesToHost, type FailureKind } from './escalation.ts'
import { friendlyApiMessage } from './localErrors.ts'

describe('escalatesToHost', () => {
  const table: [FailureKind, boolean][] = [
    ['handshake', true],
    ['protocol_mismatch', true],
    ['launch', true],
    ['token_refresh', true],
    ['crash', true],
    ['feature_api_error', false],
    ['moodle_source_not_provided', false],
  ]
  for (const [kind, expected] of table) {
    it(`${kind} -> ${expected ? 'escalates' : 'stays local'}`, () => {
      assert.equal(escalatesToHost(kind), expected)
    })
  }
})

describe('classifyFeatureError', () => {
  const table: [number, string | undefined, FailureKind][] = [
    [501, 'moodle_source_not_provided', 'moodle_source_not_provided'],
    [501, undefined, 'feature_api_error'],
    [500, undefined, 'feature_api_error'],
    [503, 'unavailable', 'feature_api_error'],
    [0, undefined, 'feature_api_error'],
    [403, 'forbidden', 'feature_api_error'],
    [404, 'not_found', 'feature_api_error'],
    [422, 'invalid', 'feature_api_error'],
  ]
  for (const [status, code, kind] of table) {
    it(`HTTP ${status} ${code ?? ''} is ${kind}, which never escalates`, () => {
      assert.equal(classifyFeatureError(status, code), kind)
      assert.equal(escalatesToHost(classifyFeatureError(status, code)), false)
    })
  }
})

describe('friendlyApiMessage', () => {
  it('speaks Spanish and hides the technical code outside development', () => {
    assert.equal(
      friendlyApiMessage(501, 'moodle_source_not_provided', false),
      'Esta función no está disponible en este modo.'
    )
    assert.doesNotMatch(friendlyApiMessage(500, 'boom', false), /boom|500/)
  })

  it('shows the technical code in development', () => {
    assert.match(friendlyApiMessage(500, 'boom', true), /boom \(HTTP 500\)/)
  })

  it('has a message for every status family', () => {
    for (const status of [0, 400, 401, 403, 404, 409, 412, 422, 429, 500, 502, 503]) {
      assert.ok(friendlyApiMessage(status, undefined, false).length > 10, String(status))
    }
  })
})
