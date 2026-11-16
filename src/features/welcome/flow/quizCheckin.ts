import type { QuizResult } from '../../embed/protocol.ts'
import { confirmsCompletion } from './quizOutcome.ts'

// The check-in half of a quiz step: what the viewer sees while the app asks Moodle
// about the quiz, and when the recorded way out ("Continuar de todos modos") shows
// up. Pure (no React, no timers, no clock: events carry the time), so the escape
// timing is tested with a fake clock. The completion itself is decided by
// quizOutcome.ts and the flow reducer; this only drives the feedback and the exit.

// Nothing answered a check within this time: the message shows and the button works again.
export const CHECK_TIMEOUT_MS = 5_000
// The viewer opened the quiz and this long went by: the exit shows.
export const ESCAPE_AFTER_OPEN_MS = 45_000
// Opened, and this many checks in a row did not confirm completion: the exit shows.
export const ESCAPE_AFTER_CHECKS = 2
// An overlay close is followed by a state refresh, and each asks. Two answers
// within this gap are one look at Moodle, not two: otherwise opening the quiz and
// closing it at once would already show the exit.
export const CHECK_COUNT_GAP_MS = 3_000

export type CheckOutcome =
  | {
      kind: 'result'
      finishedAttempts: number
      inProgress: boolean
      previewAttempts: number
    }
  | { kind: 'error' }
  | { kind: 'timeout' }

export interface CheckinState {
  now: number
  // When the viewer first opened the quiz; null before that.
  openedAt: number | null
  // A request is out: the button is disabled and says so.
  pendingSince: number | null
  // Not-confirming answers in a row, after the quiz was opened.
  streak: number
  // When the check that last counted toward the streak was sent.
  lastCountedAt: number | null
  // The latest outcome with its time, for "Última comprobación".
  last: { at: number; outcome: CheckOutcome } | null
  // An error reply or a missing reply was seen: the exit shows at once.
  trouble: boolean
}

export const createCheckin = (now: number): CheckinState => ({
  now,
  openedAt: null,
  pendingSince: null,
  streak: 0,
  lastCountedAt: null,
  last: null,
  trouble: false,
})

export type CheckinEvent =
  | { type: 'tick'; at: number }
  | { type: 'opened'; at: number }
  | { type: 'check-start'; at: number }
  | { type: 'answer'; at: number; result: QuizResult }
  | { type: 'error'; at: number }
  | { type: 'timeout'; at: number }

export const checkinReducer = (state: CheckinState, event: CheckinEvent): CheckinState => {
  const next = { ...state, now: Math.max(state.now, event.at) }
  switch (event.type) {
    case 'tick':
      return next
    case 'opened':
      return state.openedAt === null ? { ...next, openedAt: event.at } : next
    case 'check-start':
      // One request at a time: a second trigger during a pending check is the same look.
      return state.pendingSince === null ? { ...next, pendingSince: event.at } : next
    case 'answer': {
      const confirmed = confirmsCompletion(event.result)
      const sentAt = state.pendingSince ?? event.at
      const counts =
        !confirmed &&
        state.openedAt !== null &&
        (state.lastCountedAt === null || sentAt - state.lastCountedAt >= CHECK_COUNT_GAP_MS)
      return {
        ...next,
        pendingSince: null,
        // A confirmed result ends the wait; a repeat answer inside the gap neither
        // adds nor resets.
        streak: confirmed ? 0 : counts ? state.streak + 1 : state.streak,
        lastCountedAt: counts ? sentAt : state.lastCountedAt,
        trouble: false,
        last: {
          at: event.at,
          outcome: {
            kind: 'result',
            finishedAttempts: event.result.finishedAttempts,
            inProgress: event.result.inProgress,
            previewAttempts: event.result.previewAttempts ?? 0,
          },
        },
      }
    }
    case 'error':
      return {
        ...next,
        pendingSince: null,
        trouble: true,
        last: { at: event.at, outcome: { kind: 'error' } },
      }
    case 'timeout':
      // Only a request still out can time out; a late timer does nothing.
      return state.pendingSince === null
        ? next
        : {
            ...next,
            pendingSince: null,
            trouble: true,
            last: { at: event.at, outcome: { kind: 'timeout' } },
          }
  }
}

export const isChecking = (state: CheckinState): boolean => state.pendingSince !== null

// Whether the exit shows. Not before the viewer had a fair chance: opened the quiz
// and two checks in a row did not confirm, or 45 s since they opened it. Any error
// or missing reply shows it at once, since waiting would not help.
export const escapeVisible = (state: CheckinState): boolean => {
  if (state.trouble) return true
  if (state.openedAt === null) return false
  return state.streak >= ESCAPE_AFTER_CHECKS || state.now - state.openedAt >= ESCAPE_AFTER_OPEN_MS
}

// When the exit would show by time alone, so the view can wake exactly then.
export const escapeDueAt = (state: CheckinState): number | null =>
  state.openedAt === null ? null : state.openedAt + ESCAPE_AFTER_OPEN_MS

// The time left on a pending check before it counts as unanswered.
export const checkTimeoutIn = (state: CheckinState): number | null =>
  state.pendingSince === null
    ? null
    : Math.max(0, state.pendingSince + CHECK_TIMEOUT_MS - state.now)
