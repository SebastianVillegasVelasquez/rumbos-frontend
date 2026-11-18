import { ContractError, Issues, isRecord, kindOf } from '../course-map/data/contract.ts'
import type { AssessmentList } from './types.ts'

// The list of assessments, checked at the edge. `enabled: false` is a whole answer
// (the map has none) and carries no policy or items; `enabled: true` must carry both.
// Both leave here with `items` as an array, so no reader has to guess.

const ENDPOINT = 'GET /trainer/assessments'

export const parseAssessmentList = (value: unknown, endpoint = ENDPOINT): AssessmentList => {
  if (!isRecord(value))
    throw new ContractError(endpoint, [`body: expected an object, got ${kindOf(value)}`])
  const issues = new Issues()
  issues.boolean('enabled', value.enabled)
  issues.optional('preview', value.preview, (path, v) => issues.boolean(path, v))
  if (value.enabled === true) {
    if (issues.record('policy', value.policy)) {
      issues.number('policy.pass_percent', value.policy.pass_percent)
      issues.number('policy.time_limit_min', value.policy.time_limit_min)
      issues.string('policy.pass_operator', value.policy.pass_operator)
    }
    issues.array('items', value.items, (path, item) => {
      if (!issues.record(path, item)) return
      issues.string(`${path}.purpose`, item.purpose)
      issues.string(`${path}.title`, item.title)
      issues.string(`${path}.state`, item.state)
      if (issues.record(`${path}.attempts`, item.attempts)) {
        issues.number(`${path}.attempts.used`, item.attempts.used)
        issues.number(`${path}.attempts.max`, item.attempts.max)
      }
    })
  }
  issues.settle(endpoint)
  const preview = value.preview === true
  if (value.enabled === false) return { enabled: false, preview, items: [] }
  return { ...value, preview } as unknown as AssessmentList
}
