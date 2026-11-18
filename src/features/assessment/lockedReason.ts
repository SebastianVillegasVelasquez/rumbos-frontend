import { esAssessment } from '../../i18n/assessment.es.ts'

// Why an exam cannot be opened, in words for the student. The backend's
// `locked_reason` is a machine code (for example "not_available" for a form that is
// still a draft): it is looked up here and never shown as it came. A code this app does
// not know reads as the generic sentence, so a new backend code is never leaked either.

export type UnavailableReason = keyof typeof esAssessment.step.reasons

export const KNOWN_LOCKED_CODES = ['not_available'] as const

export const reasonOfLockedCode = (code: string | null | undefined): UnavailableReason =>
  code === 'not_available' ? 'not_available' : 'locked'

export const reasonText = (
  reason: UnavailableReason,
  purpose: 'check_in' | 'final' = 'check_in'
): string =>
  purpose === 'final' ? esAssessment.stepFinal.reasons[reason] : esAssessment.step.reasons[reason]

// The sentence for an item's `locked_reason`, or null when there is none to say.
export const lockedReasonText = (code: string | null | undefined): string | null =>
  code ? reasonText(reasonOfLockedCode(code)) : null
