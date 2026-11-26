import type { ClosingAvailability } from '../course-map/data/types.ts'
import { stageOf } from './closingJourney.ts'
import type { ClosingStatus } from './closingStatus.ts'

// What the HUD's "Cierre" button says, from the backend's closing status. The backend's reasons
// are looked up in hud/closingEntry.ts and never shown as they came.
export const availabilityFromStatus = (
  status: ClosingStatus | null | undefined
): ClosingAvailability | null => {
  if (!status) return null
  const stage = stageOf(status)
  // A passed check-in exempts the student from the final exam: the closing is open to them.
  if (stage === 'passed_checkin') return { available: true, reason: null }
  const reason = status.reason
  const mapped =
    reason === 'already_passed'
      ? 'already_passed'
      : reason === 'no_attempts_left'
        ? 'attempts_exhausted'
        : reason === 'scorm_incomplete'
          ? 'scorm_incomplete'
          : reason === 'not_enabled' || reason === 'no_final_step' || reason === 'form_unavailable'
            ? 'not_configured'
            : reason
  return {
    available: status.available,
    reason: status.available ? null : mapped,
    scorm: status.progress
      ? { completed: status.progress.completed, required: status.progress.total }
      : null,
  }
}

// The screens that appear once per student and journey step (the congratulations after a pass,
// the "review again" after three failures), remembered so they do not come back on every visit.
export type JourneyScreen = 'congrats_checkin' | 'congrats_final' | 'exhausted'

const key = (mapId: string, screen: JourneyScreen) => `rumbos:journey:${mapId}:${screen}`

export const wasScreenSeen = (storage: Storage | null, mapId: string, screen: JourneyScreen) => {
  try {
    return storage?.getItem(key(mapId, screen)) === '1'
  } catch {
    return false
  }
}

export const markScreenSeen = (storage: Storage | null, mapId: string, screen: JourneyScreen) => {
  try {
    storage?.setItem(key(mapId, screen), '1')
  } catch {
    // Nothing is remembered: the screen may show again, which is harmless.
  }
}
