import type { ClosingStatus } from './closingStatus.ts'
import type { UnavailableReason } from './lockedReason.ts'
import type { AssessmentListItem } from './types.ts'

// The final exam while the backend's closing gate is on (`observe` or `enforce`): it is left
// out of GET /trainer/assessments, and GET /trainer/closing carries its list item. What the
// student may do with it is `outcome.final.status`, never the item's own `state`, which
// ignores the content condition and the check-in's exemption.

export type FinalOffer =
  | { kind: 'ready'; item: AssessmentListItem }
  | { kind: 'passed' }
  | { kind: 'unavailable'; reason: UnavailableReason }

// Null when the status does not offer the final this way (gate off, or no final exam).
export const finalOfferOf = (status: ClosingStatus): FinalOffer | null => {
  const final = status.outcome?.final
  const item = status.final?.item
  if (!final || !item) return null
  const ready = (state: AssessmentListItem['state']): FinalOffer => ({
    kind: 'ready',
    item: { ...item, state, locked_reason: null },
  })
  switch (final.status) {
    case 'passed':
    case 'not_required_passed_checkin':
      return { kind: 'passed' }
    case 'exhausted':
      return ready('exhausted')
    case 'required':
      return ready(item.in_progress ? 'in_progress' : 'available')
    case 'locked':
      return {
        kind: 'unavailable',
        reason:
          final.reason === 'scorm_incomplete'
            ? 'scorm_incomplete'
            : final.reason === 'form_unavailable'
              ? 'not_available'
              : 'locked',
      }
  }
}
