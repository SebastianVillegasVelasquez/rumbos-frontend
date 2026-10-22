import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { completionEnabledOf, getHostState, setHostState } from './hostState.ts'
import type { CourseState } from './protocol.ts'

const base: CourseState = {
  schemaVersion: 1,
  courseId: 7,
  generatedAt: '2026-01-01T00:00:00Z',
  sections: [],
  activities: [],
  unavailableCmids: [],
}

afterEach(() => setHostState(null))

describe('completionEnabledOf', () => {
  it('is null (unknown) without state or without the field', () => {
    assert.equal(completionEnabledOf(null), null)
    assert.equal(completionEnabledOf(base), null)
  })

  it('reports the host value, false included', () => {
    assert.equal(completionEnabledOf({ ...base, courseCompletionEnabled: true }), true)
    assert.equal(completionEnabledOf({ ...base, courseCompletionEnabled: false }), false)
  })
})

describe('setHostState', () => {
  it('ignores a refresh that only moves the timestamp', () => {
    setHostState(base)
    const first = getHostState()
    setHostState({ ...base, generatedAt: '2026-01-01T00:01:00Z' })
    assert.equal(getHostState(), first)
  })

  it('applies a change of courseCompletionEnabled', () => {
    setHostState(base)
    setHostState({ ...base, courseCompletionEnabled: false })
    assert.equal(completionEnabledOf(getHostState()), false)
  })
})
