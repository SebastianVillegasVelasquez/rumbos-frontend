import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ApiError } from '../course-map/data/apiError.ts'
import { classifyFailure } from './failure.ts'

const api = (status: number, code?: string) =>
  new ApiError(status, code ? { detail: { code, message: 'm' } } : undefined)

describe('failure classes', () => {
  it('maps the contract status codes', () => {
    assert.equal(classifyFailure(api(0)), 'unreachable')
    assert.equal(classifyFailure(api(401)), 'unauthorized')
    assert.equal(classifyFailure(api(409, 'no_attempts_left')), 'no_attempts_left')
    assert.equal(classifyFailure(api(409, 'locked')), 'locked')
    assert.equal(classifyFailure(api(409, 'submitted')), 'closed')
    assert.equal(classifyFailure(api(409, 'expired')), 'closed')
    assert.equal(classifyFailure(api(503)), 'unreachable')
    assert.equal(classifyFailure(api(429)), 'unreachable')
    assert.equal(classifyFailure(api(422)), 'other')
    assert.equal(classifyFailure(new Error('x')), 'other')
  })

  it('knows the closing flow guard (draft code), as a 409 or a 403', () => {
    assert.equal(classifyFailure(api(409, 'closing_not_available')), 'closing_not_available')
    assert.equal(classifyFailure(api(403, 'closing_not_available')), 'closing_not_available')
    assert.equal(classifyFailure(api(403, 'something_else')), 'other')
  })
})
