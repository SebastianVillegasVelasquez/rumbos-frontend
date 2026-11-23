import { es } from '../../i18n/es.ts'
import type { ClosingAvailability } from '../course-map/data/types.ts'

// DRAFT, not in contracts/openapi.json: the reasons the backend gives when the closing
// flow is closed to a student. Keys are ours; the backend's codes are looked up here and
// never shown as they came. A code not listed reads as the neutral sentence.
export const CLOSING_REASONS = [
  'scorm_incomplete',
  'not_configured',
  'already_passed',
  'attempts_exhausted',
] as const
export type ClosingReason = (typeof CLOSING_REASONS)[number]

export const closingReasonOf = (code: string | null | undefined): ClosingReason | 'other' =>
  (CLOSING_REASONS as readonly string[]).includes(code ?? '') ? (code as ClosingReason) : 'other'

export interface ClosingEntryView {
  enabled: boolean
  // Why it is closed, in words; null when it is open.
  note: string | null
  // True when pressing "Continuar" can take the student to the next pending bubble.
  offersContinue: boolean
}

// What the HUD says about "Cierre". An editor in preview can always open it; otherwise
// the backend's answer decides (no answer is closed, never open by guess).
export const closingEntryView = (
  availability: ClosingAvailability | null | undefined,
  editorPreview: boolean
): ClosingEntryView => {
  if (editorPreview || availability?.available === true)
    return { enabled: true, note: null, offersContinue: false }
  const text = es.hud.closingReasons
  const reason = closingReasonOf(availability?.reason)
  if (reason === 'scorm_incomplete') {
    const scorm = availability?.scorm
    const counts =
      scorm && Number.isInteger(scorm.required) && Number.isInteger(scorm.completed) ? scorm : null
    return {
      enabled: false,
      note: counts
        ? text.scorm_incomplete(Math.max(0, counts.completed), counts.required)
        : text.scorm_incomplete_unknown,
      offersContinue: true,
    }
  }
  return {
    enabled: false,
    note: reason === 'other' ? text.other : text[reason],
    offersContinue: false,
  }
}
