import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { ApiError } from '../course-map/data/apiError.ts'
import { classifyFailure } from './failure.ts'

describe('classifying a practice failure', () => {
  const logged: unknown[][] = []
  const realError = console.error
  beforeEach(() => {
    logged.length = 0
    console.error = (...args: unknown[]) => void logged.push(args)
  })
  afterEach(() => {
    console.error = realError
  })

  it('tells a route the backend lacks from a practice that is closed, and names the route', () => {
    const missing = new ApiError(404, { detail: 'Not Found' }, 'GET /trainer/activities/a1')
    assert.equal(classifyFailure(missing), 'contract')
    assert.equal(logged.length, 1)
    assert.match(String(logged[0]?.[0]), /GET \/trainer\/activities\/a1/)
    assert.match(String(logged[0]?.[0]), /404/)
  })

  it('keeps a coded 404 as closed, without logging a contract violation', () => {
    const closed = new ApiError(404, { detail: { code: 'session_not_found', message: 'x' } })
    assert.equal(classifyFailure(closed), 'closed')
    assert.equal(logged.length, 0)
  })

  it('keeps the other classes', () => {
    assert.equal(classifyFailure(new ApiError(0, undefined)), 'unreachable')
    assert.equal(classifyFailure(new ApiError(401, undefined)), 'unauthorized')
    assert.equal(classifyFailure(new ApiError(503, undefined)), 'unreachable')
    assert.equal(classifyFailure(new Error('x')), 'other')
  })
})
