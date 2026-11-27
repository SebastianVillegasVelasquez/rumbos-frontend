import { ContractError, Issues, isRecord, kindOf } from '../course-map/data/contract.ts'
import type { AssessmentListItem } from './types.ts'

// GET /trainer/closing, checked at the edge: whether the final exam of the closing flow may be
// started, why not, how much required content is done, and how the student's journey through
// the two exams stands (`outcome`, absent while the backend's gate is off). The backend's
// word is the only source of the journey: nothing here is worked out from a score.

const ENDPOINT = 'GET /trainer/closing'

export const CLOSING_REASONS = [
  'not_enabled',
  'no_final_step',
  'form_unavailable',
  'already_passed',
  'no_attempts_left',
  'scorm_incomplete',
  'progress_unavailable',
  'user_unlinked',
] as const
export type ClosingReasonCode = (typeof CLOSING_REASONS)[number]

export const FINAL_STATUSES = [
  'required',
  'not_required_passed_checkin',
  'passed',
  'exhausted',
  'locked',
] as const
export type FinalStatus = (typeof FINAL_STATUSES)[number]

export type CheckinStatus = 'not_taken' | 'passed' | 'not_passed'

export interface Attempts {
  used: number
  max: number
}

export interface CheckinOutcome {
  status: CheckinStatus
  // The score of the attempt that decided it, as the exam reports it (two decimals); null before
  // any attempt. Shown, never compared: `status` decides.
  percent: string | null
  passPercent: number
  passOperator: 'gt' | 'gte'
  attempts: Attempts
}

export interface FinalOutcome {
  status: FinalStatus
  reason: ClosingReasonCode | null
  attempts: Attempts | null
  // The score of the final attempt that decides (the passing one, else the best) and the rule
  // it was graded with; with no final sat, no score and the map's rule. All null without a
  // final exam. Shown, never compared: `status` decides.
  percent: string | null
  passPercent: number | null
  passOperator: 'gt' | 'gte' | null
}

export interface ClosingOutcome {
  checkin: CheckinOutcome | null
  final: FinalOutcome
  // Whether the SCORM condition of the gate is met; `passed_checkin` when a passed check-in met
  // it. `not_checked`: the backend runs in observe mode and does not check the content, so what
  // waits for the content is decided on screen (closingResume.ts).
  scormGate: { satisfied: boolean | null; reason: 'passed_checkin' | 'not_checked' | null }
}

export interface ClosingStatus {
  enforced: boolean
  preview: boolean
  available: boolean
  reason: ClosingReasonCode | null
  progress: { completed: number; total: number } | null
  // The final exam's own state, when the map has one. `item` is its list item: while the gate
  // is on, the backend leaves the final out of GET /trainer/assessments and this is where the
  // exam step finds it. Its `state` ignores the journey: `outcome.final.status` decides.
  final: { attempts: Attempts | null; item: AssessmentListItem | null } | null
  // Null while the gate is off, or from an older backend.
  outcome: ClosingOutcome | null
}

const isOneOf = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (list as readonly string[]).includes(value)

const reasonOf = (value: unknown): ClosingReasonCode | null =>
  isOneOf(CLOSING_REASONS, value) ? value : null

const attemptsOf = (value: unknown): Attempts | null =>
  isRecord(value) && Number.isInteger(value.used) && Number.isInteger(value.max)
    ? { used: value.used as number, max: value.max as number }
    : null

const operatorOf = (value: unknown): 'gt' | 'gte' | null =>
  value === 'gt' || value === 'gte' ? value : null

const itemOf = (value: unknown): AssessmentListItem | null =>
  isRecord(value) &&
  value.purpose === 'final' &&
  typeof value.title === 'string' &&
  Number.isInteger(value.section_count) &&
  Number.isInteger(value.item_count) &&
  attemptsOf(value.attempts) !== null
    ? (value as unknown as AssessmentListItem)
    : null

const parseOutcome = (value: unknown, issues: Issues): ClosingOutcome | null => {
  if (value === null || value === undefined) return null
  if (!issues.record('outcome', value)) return null
  const final = value.final
  if (!issues.record('outcome.final', final)) return null
  // A status a newer backend adds is not one this app can play: no journey rather than a guess.
  if (!isOneOf(FINAL_STATUSES, final.status)) return null
  let checkin: CheckinOutcome | null = null
  if (isRecord(value.checkin)) {
    const c = value.checkin
    const attempts = attemptsOf(c.attempts)
    if (
      isOneOf(['not_taken', 'passed', 'not_passed'] as const, c.status) &&
      attempts &&
      typeof c.pass_percent === 'number' &&
      (c.pass_operator === 'gt' || c.pass_operator === 'gte')
    )
      checkin = {
        status: c.status,
        percent: typeof c.percent === 'string' ? c.percent : null,
        passPercent: c.pass_percent,
        passOperator: c.pass_operator,
        attempts,
      }
  }
  const gate = isRecord(value.scorm_gate) ? value.scorm_gate : {}
  return {
    checkin,
    final: {
      status: final.status,
      reason: reasonOf(final.reason),
      attempts: attemptsOf(final.attempts),
      percent: typeof final.percent === 'string' ? final.percent : null,
      passPercent: typeof final.pass_percent === 'number' ? final.pass_percent : null,
      passOperator: operatorOf(final.pass_operator),
    },
    scormGate: {
      satisfied: typeof gate.satisfied === 'boolean' ? gate.satisfied : null,
      reason:
        gate.reason === 'passed_checkin' || gate.reason === 'not_checked' ? gate.reason : null,
    },
  }
}

export const parseClosingStatus = (value: unknown, endpoint = ENDPOINT): ClosingStatus => {
  if (!isRecord(value))
    throw new ContractError(endpoint, [`body: expected an object, got ${kindOf(value)}`])
  const issues = new Issues()
  issues.boolean('enforced', value.enforced)
  issues.boolean('preview', value.preview)
  issues.boolean('available', value.available)
  const outcome = parseOutcome(value.outcome, issues)
  let progress: ClosingStatus['progress'] = null
  if (isRecord(value.progress)) {
    if (Number.isInteger(value.progress.completed) && Number.isInteger(value.progress.total))
      progress = {
        completed: value.progress.completed as number,
        total: value.progress.total as number,
      }
    else issues.add('progress', 'two counts', value.progress)
  }
  issues.settle(endpoint)
  return {
    enforced: value.enforced === true,
    preview: value.preview === true,
    available: value.available === true,
    reason: reasonOf(value.reason),
    progress,
    final: isRecord(value.final)
      ? { attempts: attemptsOf(value.final.attempts), item: itemOf(value.final) }
      : null,
    outcome,
  }
}
