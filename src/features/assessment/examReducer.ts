import { numberItems, unanswered, type NumberedItem } from './answers.ts'
import { announcementDue, remainingMs, syncClock, type ServerClock } from './serverClock.ts'
import type {
  AssessmentPurpose,
  AssessmentResult,
  AttemptStart,
  ItemResponse,
  SaveAck,
  SectionPayload,
  SectionSummary,
} from './types.ts'

// The exam runner's state machine. Pure: no React, no DOM, no timers, no fetch.
// Events carry the device time they happened at (`now`), so the countdown and the
// resume path are tested with a fake clock. The hook (useExam.ts) runs the
// network and feeds the answers back as events.
//
// Phases: idle, starting (a new attempt), resuming (an attempt already in
// progress), running, saving (running with a save in flight: the student keeps
// answering), submitting, submitted, expired, error.
//
// What is never here: keys, correctness or accepted answers. The server does not
// send them (leakGuard.ts refuses a response that does) and the state has no field
// to put them in.

export type Phase =
  | 'idle'
  | 'starting'
  | 'resuming'
  | 'running'
  | 'saving'
  | 'submitting'
  | 'submitted'
  | 'expired'
  | 'error'

export type FailureKind =
  | 'unreachable'
  | 'unauthorized'
  | 'no_attempts_left'
  | 'locked'
  // DRAFT guard of the closing flow: the backend refused because the gate is closed.
  | 'closing_not_available'
  | 'closed'
  | 'other'

// What "Reintentar" does after a failure.
export type RetryAction = 'start' | 'section' | 'submit'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed'

export interface ExamError {
  kind: FailureKind
  retry: RetryAction
}

export interface ExamState {
  phase: Phase
  purpose: AssessmentPurpose | null
  attemptId: string | null
  summaries: SectionSummary[]
  // By section index; null until loaded. Held in memory only, for this attempt.
  sections: (SectionPayload | null)[]
  sectionIndex: number
  view: 'section' | 'review'
  // Every answer the student gave, saved or not.
  answers: Record<string, ItemResponse>
  // Changed since the last acknowledged save.
  dirty: Record<string, ItemResponse>
  // Being saved right now (a copy: later edits go to `dirty` again).
  inflight: Record<string, ItemResponse>
  saveStatus: SaveStatus
  clock: ServerClock | null
  remainingMs: number | null
  // The threshold (10, 5 or 1 minutes) to say aloud once; cleared by `announced`.
  announcement: number | null
  // The deadline passed on the clock: the runner submits by itself.
  timeUp: boolean
  result: AssessmentResult | null
  error: ExamError | null
  // A section that failed to load (the others keep working).
  sectionError: number | null
}

export const initialExam: ExamState = {
  phase: 'idle',
  purpose: null,
  attemptId: null,
  summaries: [],
  sections: [],
  sectionIndex: 0,
  view: 'section',
  answers: {},
  dirty: {},
  inflight: {},
  saveStatus: 'idle',
  clock: null,
  remainingMs: null,
  announcement: null,
  timeUp: false,
  result: null,
  error: null,
  sectionError: null,
}

export type ExamEvent =
  | { type: 'start'; purpose: AssessmentPurpose; resume: boolean }
  | { type: 'started'; attempt: AttemptStart; now: number }
  | { type: 'section-loaded'; index: number; payload: SectionPayload; now: number }
  | { type: 'section-failed'; index: number }
  | { type: 'section-retry' }
  | { type: 'goto-section'; index: number }
  | { type: 'answer'; itemId: string; response: ItemResponse }
  | { type: 'save-start' }
  | { type: 'save-ok'; ack: SaveAck; now: number }
  | { type: 'save-failed'; kind: FailureKind }
  | { type: 'open-review' }
  | { type: 'close-review' }
  | { type: 'submit' }
  | { type: 'submitted'; result: AssessmentResult }
  | { type: 'result-updated'; result: AssessmentResult }
  | { type: 'failed'; kind: FailureKind; retry: RetryAction }
  | { type: 'retry'; now: number }
  | { type: 'tick'; now: number }
  | { type: 'announced' }

const isLive = (phase: Phase) => phase === 'running' || phase === 'saving'

const isSame = (a: ItemResponse, b: ItemResponse) => JSON.stringify(a) === JSON.stringify(b)

// The server's idea of the clock, taken from any answer that carries it.
const withClock = (
  state: ExamState,
  input: { server_now: string; deadline_at: string },
  now: number
): ExamState => {
  const clock = syncClock(input, now)
  if (!clock) return state
  const left = remainingMs(clock, now)
  return { ...state, clock, remainingMs: left }
}

export const examReducer = (state: ExamState, event: ExamEvent): ExamState => {
  switch (event.type) {
    case 'start':
      // A second press while one is in flight does nothing; a finished exam stays.
      if (state.phase !== 'idle' && state.phase !== 'error') return state
      return {
        ...initialExam,
        phase: event.resume ? 'resuming' : 'starting',
        purpose: event.purpose,
      }
    case 'started': {
      if (state.phase !== 'starting' && state.phase !== 'resuming') return state
      const next = withClock(
        {
          ...state,
          phase: 'running',
          attemptId: event.attempt.attempt_id,
          summaries: event.attempt.sections,
          sections: event.attempt.sections.map(() => null),
          sectionIndex: 0,
          error: null,
        },
        event.attempt,
        event.now
      )
      return next
    }
    case 'section-loaded': {
      if (!state.attemptId) return state
      const sections = state.sections.slice()
      sections[event.index] = event.payload
      // What the server saved fills the answers, but a newer local edit wins.
      const answers = { ...state.answers }
      for (const [id, response] of Object.entries(event.payload.saved))
        if (!(id in state.dirty) && !(id in state.inflight)) answers[id] = response
      return withClock(
        {
          ...state,
          sections,
          answers,
          sectionError: state.sectionError === event.index ? null : state.sectionError,
        },
        event.payload,
        event.now
      )
    }
    case 'section-failed':
      return { ...state, sectionError: event.index }
    case 'section-retry':
      return { ...state, sectionError: null }
    case 'goto-section':
      return event.index >= 0 && event.index < state.summaries.length
        ? { ...state, sectionIndex: event.index, view: 'section' }
        : state
    case 'answer': {
      // Answers are taken while running or saving, never after the exam is over.
      if (!isLive(state.phase)) return state
      return {
        ...state,
        answers: { ...state.answers, [event.itemId]: event.response },
        dirty: { ...state.dirty, [event.itemId]: event.response },
        saveStatus: state.saveStatus === 'saving' ? 'saving' : 'idle',
      }
    }
    case 'save-start': {
      if (state.phase !== 'running' || Object.keys(state.dirty).length === 0) return state
      return { ...state, phase: 'saving', inflight: state.dirty, dirty: {}, saveStatus: 'saving' }
    }
    case 'save-ok': {
      if (state.phase !== 'saving') return state
      // The inflight values are saved. A later edit is already back in `dirty`.
      const next = withClock(
        { ...state, phase: 'running', inflight: {}, saveStatus: 'saved' },
        event.ack,
        event.now
      )
      return Object.keys(next.dirty).length > 0 ? { ...next, saveStatus: 'idle' } : next
    }
    case 'save-failed': {
      if (state.phase !== 'saving') return state
      // Nothing is lost: what was in flight goes back to dirty, unless edited since.
      const dirty = { ...state.inflight, ...state.dirty }
      if (event.kind === 'closed')
        // 409 submitted or expired: the attempt is over, ask the server for the result.
        return { ...state, phase: 'submitting', dirty, inflight: {}, saveStatus: 'failed' }
      return {
        ...state,
        phase: 'running',
        dirty,
        inflight: {},
        saveStatus: 'failed',
        error: event.kind === 'unauthorized' ? { kind: 'unauthorized', retry: 'start' } : null,
      }
    }
    case 'open-review':
      return isLive(state.phase) ? { ...state, view: 'review' } : state
    case 'close-review':
      return { ...state, view: 'section' }
    case 'submit':
      // Idempotent: a double click, or a click after the timer, changes nothing.
      return isLive(state.phase) ? { ...state, phase: 'submitting', view: 'section' } : state
    case 'submitted':
      if (state.phase !== 'submitting') return state
      return {
        ...state,
        phase: event.result.status === 'expired' ? 'expired' : 'submitted',
        result: event.result,
        dirty: {},
        inflight: {},
        error: null,
      }
    case 'result-updated':
      return state.result ? { ...state, result: event.result } : state
    case 'failed':
      if (event.retry === 'section') return state
      if (event.retry === 'submit' && state.phase !== 'submitting') return state
      return { ...state, phase: 'error', error: { kind: event.kind, retry: event.retry } }
    case 'retry': {
      if (state.phase !== 'error' || !state.error) return state
      if (state.error.retry === 'submit') return { ...state, phase: 'submitting', error: null }
      // A retried start or resume begins again, keeping nothing half-loaded.
      return {
        ...initialExam,
        phase: state.attemptId ? 'resuming' : 'starting',
        purpose: state.purpose,
      }
    }
    case 'tick': {
      if (!state.clock || !isLive(state.phase)) return state
      const left = remainingMs(state.clock, event.now)
      const due = announcementDue(state.remainingMs, left)
      const timeUp = left === 0
      return {
        ...state,
        remainingMs: left,
        announcement: due ?? state.announcement,
        timeUp,
        // At zero the runner submits by itself, with what the server holds.
        phase: timeUp ? 'submitting' : state.phase,
        view: timeUp ? 'section' : state.view,
      }
    }
    case 'announced':
      return { ...state, announcement: null }
  }
}

// ---- Selectors -----------------------------------------------------------------------

export const allSectionsLoaded = (state: ExamState): boolean =>
  state.summaries.length > 0 && state.sections.every((section) => section !== null)

export const numberedItems = (state: ExamState): NumberedItem[] =>
  numberItems(
    state.sections,
    state.summaries.map((section) => section.item_count)
  )

// Only truthful once every section is loaded (the review loads the rest first).
export const unansweredItems = (state: ExamState): NumberedItem[] =>
  unanswered(numberedItems(state), state.answers)

export const totalItems = (state: ExamState): number =>
  state.summaries.reduce((sum, section) => sum + section.item_count, 0)

export const hasUnsaved = (state: ExamState): boolean =>
  Object.keys(state.dirty).length > 0 || Object.keys(state.inflight).length > 0

// "Sección 2 de 5 · Reading": the pieces of the line, free of the copy.
export const sectionLine = (state: ExamState) => ({
  index: state.sectionIndex + 1,
  total: state.summaries.length,
  title: state.summaries[state.sectionIndex]?.title ?? '',
})

export const isFinished = (phase: Phase): boolean => phase === 'submitted' || phase === 'expired'

// Which screen the student is on, for moving focus to its title when it changes. Saving is
// not a screen: every answer flips `running` to `saving` and back, and refocusing the title
// at each flip sent the scroll to the top after every question.
export const screenKey = (state: ExamState): string =>
  `${state.phase === 'saving' ? 'running' : state.phase}|${state.view}|${state.sectionIndex}`

// Used by tests and the hook to compare a pending save with what was sent.
export const sameResponse = isSame
