import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ContractError } from '../course-map/data/contract.ts'
import { parseAssessmentList } from './listContract.ts'

const item = {
  purpose: 'final',
  title: 'Evaluación final',
  section_count: 5,
  item_count: 40,
  attempts: { used: 0, max: 3 },
  state: 'available',
  locked_reason: null,
  in_progress: null,
  best: null,
}
const enabled = {
  enabled: true,
  preview: false,
  policy: { pass_percent: 70, pass_operator: 'gte', time_limit_min: 45 },
  items: [item],
}

const issuesOf = (value: unknown) => {
  try {
    parseAssessmentList(value)
  } catch (error) {
    assert.ok(error instanceof ContractError)
    return error.issues
  }
  assert.fail('expected a ContractError')
}

describe('parseAssessmentList', () => {
  it('accepts the full list', () => {
    const list = parseAssessmentList(enabled)
    assert.equal(list.enabled, true)
    assert.equal(list.items.length, 1)
  })

  it('gives a disabled map an empty items list instead of nothing', () => {
    // The answer that used to reach `list.items.find` and throw.
    for (const body of [{ enabled: false }, { enabled: false, reason: 'disabled_for_map' }]) {
      const list = parseAssessmentList(body)
      assert.deepEqual(list, { enabled: false, preview: false, items: [] })
    }
  })

  it('refuses an enabled list without its policy or its items', () => {
    assert.deepEqual(issuesOf({ enabled: true }), [
      'policy: expected an object, got undefined',
      'items: expected an array, got undefined',
    ])
  })

  it('refuses a malformed item, naming where', () => {
    assert.deepEqual(issuesOf({ ...enabled, items: [{ ...item, attempts: null }] }), [
      'items[0].attempts: expected an object, got null',
    ])
    assert.deepEqual(issuesOf({ ...enabled, items: [{ ...item, state: 4 }] }), [
      'items[0].state: expected a string, got number',
    ])
  })

  it('refuses a body that is not an object', () => {
    assert.deepEqual(issuesOf('nope'), ['body: expected an object, got string'])
  })
})
