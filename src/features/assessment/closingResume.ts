import type { WelcomeStep } from '../course-map/data/types.ts'
import { isComplete, toStepInfo, type ProgressEntry } from '../welcome/flow/flowReducer.ts'
import { isFinalStep, stageOf } from './closingJourney.ts'
import type { ClosingStatus } from './closingStatus.ts'
import type { JourneyScreen } from './journeyScreens.ts'

// Where a student is on the way to the closing, worked out again on every load. Students have no
// button into the closing flow, so this is their only way in. Two sources, both the server's: the
// backend's closing status (the journey) and the flow progress Moodle keeps for the closing steps.
// The one thing Moodle and the backend do not keep is whether a congratulations screen was
// dismissed before any closing step was done: the caller says so (`seen`).

export type ClosingFlowState =
  // No step is left for this student: there is no closing to open.
  | 'empty'
  // Moodle has not answered yet.
  | 'loading'
  | 'not_started'
  | 'in_progress'
  // Every step the student had to do is recorded.
  | 'finished'

export const closingFlowStateOf = (
  steps: readonly WelcomeStep[],
  entries: readonly ProgressEntry[] | null
): ClosingFlowState => {
  // Known without Moodle: there is nothing it could have recorded.
  if (steps.length === 0) return 'empty'
  if (entries === null) return 'loading'
  // The host's list also carries the welcome flow's steps: only the closing's count.
  const mine = entries.filter((entry) => steps.some((step) => step.key === entry.stepKey))
  if (mine.length === 0) return 'not_started'
  return isComplete(steps.map(toStepInfo), mine) ? 'finished' : 'in_progress'
}

export type ClosingPlace =
  // The map in normal mode: nothing about the closing is shown.
  | { kind: 'none' }
  | { kind: 'screen'; screen: JourneyScreen }
  // The check-in was not passed and content is left: the map, with what to do next.
  | { kind: 'route' }
  // "Continuar al cierre": the student presses it; the flow never opens over the map for this.
  | { kind: 'card' }
  // The student was in the middle of the flow: it opens again where Moodle says.
  | { kind: 'resume' }

const NOTHING: ClosingPlace = { kind: 'none' }

// In observe mode the server does not check the content: it can report the final as required
// and available before the student has done anything. Then this app waits for it.
export const contentUnchecked = (status: ClosingStatus | null | undefined): boolean =>
  status?.outcome?.scormGate.reason === 'not_checked'

// Whether every required visible bubble is complete, from the counts of the map's progress
// (progressCounts, student view: content, hidden, missing and untracked bubbles do not count).
// Null while the plugin's progress is not known: nothing is offered on a guess.
export const requiredContentDone = (
  counts: { total: number; completed: number },
  known: boolean
): boolean | null => (known ? counts.completed >= counts.total : null)

export const closingPlaceOf = ({
  status,
  flow,
  seen,
  dismissed = seen,
  contentDone = null,
}: {
  status: ClosingStatus | null | undefined
  flow: ClosingFlowState
  // A screen already read, in this visit or an earlier one.
  seen: (screen: JourneyScreen) => boolean
  // A screen read in this visit.
  dismissed?: (screen: JourneyScreen) => boolean
  // Used only where the server does not check the content (see requiredContentDone).
  contentDone?: boolean | null
}): ClosingPlace => {
  const screen = (name: JourneyScreen): ClosingPlace =>
    seen(name) ? NOTHING : { kind: 'screen', screen: name }
  switch (stageOf(status)) {
    case 'exhausted':
      return screen('exhausted')
    case 'final_passed':
      return screen('congrats_final')
    case 'passed_checkin':
      // `available` is about starting the final exam, which this student does not take.
      // A closing that held only the final ends with the congratulations: no card, no flow.
      if (flow === 'empty') return screen('congrats_checkin')
      if (flow === 'loading' || flow === 'finished') return NOTHING
      if (flow === 'in_progress') return { kind: 'resume' }
      // In observe mode a passed check-in gets no card. Until the closing has started, its
      // congratulations are the way in, so they come back on the next visit.
      if (contentUnchecked(status))
        return dismissed('congrats_checkin')
          ? NOTHING
          : { kind: 'screen', screen: 'congrats_checkin' }
      // Moodle has nothing yet: the congratulations first, the card once they were read.
      return seen('congrats_checkin') ? { kind: 'card' } : screen('congrats_checkin')
    case 'final_ready':
      if (!status?.available || flow === 'loading') return NOTHING
      if (contentUnchecked(status)) {
        const checkin = status.outcome?.checkin
        // The check-in first, where the map has one.
        if (checkin?.status === 'not_taken' || contentDone === null) return NOTHING
        // Then the content. The server never says "locked" here, so the route after a failed
        // check-in is this app's to show.
        if (!contentDone) return checkin?.status === 'not_passed' ? { kind: 'route' } : NOTHING
      }
      if (flow === 'in_progress') return { kind: 'resume' }
      // `finished` here: "Terminar" opens after any submitted attempt, passed or not, and the
      // backend still asks for the final. Without the card there would be no way to try again.
      return { kind: 'card' }
    case 'final_locked': {
      // Only when content is what stands in the way: any other lock is nothing the map solves.
      const outcome = status?.outcome
      return outcome?.checkin?.status === 'not_passed' &&
        outcome.final.reason === 'scorm_incomplete'
        ? { kind: 'route' }
        : NOTHING
    }
    default:
      return NOTHING
  }
}

// The entries the flow opens with. When Moodle has the whole flow as done but the backend still
// asks for the final exam, the final step's record is left out, so the flow opens on it.
export const entriesToOpenWith = (
  status: ClosingStatus | null | undefined,
  steps: readonly WelcomeStep[],
  entries: readonly ProgressEntry[]
): ProgressEntry[] => {
  if (stageOf(status) !== 'final_ready' || closingFlowStateOf(steps, entries) !== 'finished')
    return [...entries]
  return entries.filter(
    (entry) => !steps.some((step) => step.key === entry.stepKey && isFinalStep(step))
  )
}

// What is done once the player closes: what was known plus what it reports, keeping the newest
// revision. A flow with no mandatory step also gets the presence mark of its last step, as the
// host does (see newCompletions), so it does not read as unfinished and open again.
export const entriesAfterFinish = (
  steps: readonly WelcomeStep[],
  known: readonly ProgressEntry[],
  done: readonly ProgressEntry[]
): ProgressEntry[] => {
  const byKey = new Map<string, ProgressEntry>()
  const last = steps[steps.length - 1]
  const mark: ProgressEntry[] =
    last && !steps.some((step) => step.mandatory)
      ? [{ stepKey: last.key, revision: last.revision, method: 'completed' }]
      : []
  for (const entry of [...known, ...mark, ...done]) {
    const previous = byKey.get(entry.stepKey)
    if (!previous || entry.revision >= previous.revision) byKey.set(entry.stepKey, entry)
  }
  return [...byKey.values()]
}
