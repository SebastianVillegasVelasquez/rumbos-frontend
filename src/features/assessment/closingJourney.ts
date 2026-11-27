import type { WelcomeStep } from '../course-map/data/types.ts'
import type { ClosingStatus } from './closingStatus.ts'

// Where a student stands in the two journeys, decided only from what the backend said
// (`GET /trainer/closing`), never from a score or a count the client works out. Pure: the
// screens read a stage and show what it says.
//
//   passed check-in  -> congratulations, then the closing flow WITHOUT the final exam
//   not passed       -> the map, then (all required content done) "Continuar al cierre", then
//                       the closing flow WITH the final exam (3 attempts)
//   final passed     -> congratulations
//   attempts spent   -> a screen that sends the student back to the content and to their tutor
//                       (nothing restarts the course)
export type JourneyStage =
  // The check-in was passed: the final exam is not required.
  | 'passed_checkin'
  // The final exam may be sat now.
  | 'final_ready'
  // The final exam is required but the content is not done (or the gate says why not).
  | 'final_locked'
  | 'final_passed'
  | 'exhausted'
  // No outcome: the gate is off, an older backend, or a status this app does not know.
  | 'unknown'

export const stageOf = (status: ClosingStatus | null | undefined): JourneyStage => {
  const final = status?.outcome?.final
  if (!final) return 'unknown'
  switch (final.status) {
    case 'not_required_passed_checkin':
      return 'passed_checkin'
    case 'passed':
      return 'final_passed'
    case 'exhausted':
      return 'exhausted'
    case 'required':
      return 'final_ready'
    case 'locked':
      return 'final_locked'
  }
}

export const isFinalStep = (step: WelcomeStep): boolean =>
  step.type === 'assessment' && step.purpose === 'final'

// The steps of the closing flow this student sees. A passed check-in exempts them from the final
// exam, so its step is left out (`final: not_required_passed_checkin`); everyone else sees every
// step. A flow that would be left empty by this is the author's mistake to see, so it stays whole.
export const closingStepsFor = (
  steps: readonly WelcomeStep[],
  status: ClosingStatus | null | undefined
): WelcomeStep[] => {
  if (stageOf(status) !== 'passed_checkin') return [...steps]
  const rest = steps.filter((step) => !isFinalStep(step))
  return rest.length > 0 ? rest : [...steps]
}

// What the student has left to finish before the closing opens, for the map's line of progress.
export const remainingContent = (status: ClosingStatus | null | undefined): number | null => {
  const progress = status?.progress
  if (!progress || progress.total < 0 || progress.completed < 0) return null
  return Math.max(0, progress.total - progress.completed)
}

// The values the congratulations screen substitutes: the score of the attempt that decided it
// and the threshold it was graded with, as the backend reports them.
export const congratulationsValues = (
  status: ClosingStatus | null | undefined,
  purpose: 'checkin' | 'final'
): { score: string | null; threshold: number | null } => {
  const checkin = status?.outcome?.checkin
  if (purpose === 'checkin' && checkin)
    return { score: checkin.percent, threshold: checkin.passPercent }
  return { score: null, threshold: checkin?.passPercent ?? null }
}
