import type { CourseState } from '../../embed/protocol.ts'
import type { HostQuizView } from '../../embed/hostFlow.ts'
import type { QuizGate, QuizUnavailableReason } from './flowReducer.ts'

// What a quiz step knows about its quiz, and when it asks Moodle for the result.
// Free of React and of the host so the races can be tested.

// ---- Availability, from the course state --------------------------------------------

// `null`: the quiz is there for this user. Otherwise the step does not block and
// records `unavailable`. The course state is the host view of the current user:
// a hidden activity is not in `activities` and its cmid is in `unavailableCmids`.
export const quizAvailability = (
  state: CourseState | null,
  cmid: number | null
): QuizUnavailableReason | null => {
  if (cmid === null) return 'unlinked'
  // No state at all (standalone app): there is no Moodle to take the quiz in.
  if (state === null) return 'missing'
  if (state.unavailableCmids.includes(cmid)) return 'hidden'
  const activity = state.activities.find((item) => item.cmid === cmid)
  if (!activity || activity.modname !== 'quiz') return 'missing'
  if (activity.availability === 'hidden') return 'hidden'
  if (activity.availability === 'restricted') return 'restricted'
  return null
}

// ---- The host answer as a gate -------------------------------------------------------

export const gateFromView = (view: HostQuizView | null): QuizGate => {
  if (!view) return { kind: 'pending' }
  if (view.status === 'ready') return { kind: 'result', result: view.result }
  // not_found, unavailable and capability all mean: this user cannot take it here.
  return { kind: 'unavailable', reason: view.error === 'not_found' ? 'not_found' : 'unavailable' }
}

// ---- When to ask -------------------------------------------------------------------

// The host closes its overlay, THEN sends a fresh state (or the app asks 1.5 s
// later), and an attempt that ends inside the overlay is only visible to Moodle
// queries after that. Asking at one moment would race it, so the result is asked
// on every moment that could change it while the step is active, and the latest
// answer wins:
//   - when the step opens,
//   - when the host overlay closes,
//   - on every new host-state (the answer to the refresh after the overlay),
//   - when the tab becomes visible or the window regains focus.
// Asks are coalesced: a burst is one message, and the last trigger is never lost.
export const RESULT_ASK_GAP_MS = 800
// Nothing answered the first ask: an older plugin. The step stops waiting.
export const RESULT_SILENCE_MS = 6_000

export type QuizTrigger = 'open' | 'overlay-closed' | 'host-state' | 'visible'

export interface QuizWatcherDeps {
  ask: () => void
  // How many answers (of any kind) the host has sent so far.
  answeredCount: () => number
  now: () => number
  schedule: (run: () => void, delayMs: number) => () => void
  // The host never answered the asks: the step does not block.
  onSilent: () => void
}

export interface QuizWatcher {
  trigger: (trigger: QuizTrigger) => void
  dispose: () => void
}

export const createQuizWatcher = (deps: QuizWatcherDeps): QuizWatcher => {
  let lastAskAt = -Infinity
  let cancelAsk: (() => void) | null = null
  let cancelSilence: (() => void) | null = null
  let answeredAtFirstAsk: number | null = null
  let disposed = false

  const sendNow = () => {
    cancelAsk = null
    if (disposed) return
    lastAskAt = deps.now()
    deps.ask()
    if (answeredAtFirstAsk === null) {
      answeredAtFirstAsk = deps.answeredCount()
      cancelSilence = deps.schedule(() => {
        cancelSilence = null
        if (!disposed && deps.answeredCount() === answeredAtFirstAsk) deps.onSilent()
      }, RESULT_SILENCE_MS)
    }
  }

  return {
    trigger: () => {
      if (disposed || cancelAsk) return
      const wait = lastAskAt + RESULT_ASK_GAP_MS - deps.now()
      if (wait <= 0) sendNow()
      else cancelAsk = deps.schedule(sendNow, wait)
    },
    dispose: () => {
      disposed = true
      cancelAsk?.()
      cancelSilence?.()
      cancelAsk = null
      cancelSilence = null
    },
  }
}
