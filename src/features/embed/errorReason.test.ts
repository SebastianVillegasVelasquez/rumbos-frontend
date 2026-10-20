import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { describeHttpFailure } from './errorReason.ts'

describe('describeHttpFailure', () => {
  it('names a network failure', () => {
    assert.equal(describeHttpFailure(0), 'network error')
  })

  it('combines a safe backend code with the status', () => {
    assert.equal(describeHttpFailure(401, 'launch_invalid'), 'launch_invalid (HTTP 401)')
  })

  it('drops a code that is free text rather than an identifier', () => {
    assert.equal(describeHttpFailure(500, 'Bearer eyJhbGciOi secret'), 'http_error (HTTP 500)')
    assert.equal(describeHttpFailure(502, undefined), 'http_error (HTTP 502)')
    assert.equal(describeHttpFailure(400, { code: 'x' }), 'http_error (HTTP 400)')
  })
})
