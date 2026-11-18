import { pairUp, unpair } from '../assessment/answers.ts'
import type {
  AnswerResult,
  Progress,
  SessionStart,
  SessionSummary,
  Step,
  StepResponse,
} from './types.ts'

// One practice session as a pure state machine; the hook runs the effects. A failed
// answer keeps what was typed and the same attempt_id, so a retry is idempotent on
// the server. There is no offline queue.

// `contract`: the backend has no such route (a 404 without a business code), so retrying
// or telling the student it is closed would both be wrong. The route goes to the console.
export type FailureKind = 'unreachable' | 'unauthorized' | 'closed' | 'contract' | 'other'

export type SessionPhase =
  | 'idle'
  | 'starting'
  | 'step' // answering
  | 'checking' // answer sent, waiting
  | 'feedback' // result shown
  | 'finishing'
  | 'summary'
  | 'error'

export interface SessionState {
  phase: SessionPhase
  sessionId: string | null
  preview: boolean
  step: Step | null
  progress: Progress | null
  // What the student has so far for the current step.
  draft: StepResponse | null
  attemptId: string | null
  result: AnswerResult | null
  summary: SessionSummary | null
  failure: FailureKind | null
  // What to repeat on "Reintentar".
  failedAt: 'start' | 'answer' | 'finish' | null
}

export const initialSession: SessionState = {
  phase: 'idle',
  sessionId: null,
  preview: false,
  step: null,
  progress: null,
  draft: null,
  attemptId: null,
  result: null,
  summary: null,
  failure: null,
  failedAt: null,
}

export type SessionEvent =
  | { type: 'start' }
  | { type: 'started'; start: SessionStart }
  | { type: 'draft'; response: StepResponse | null }
  | { type: 'submit'; attemptId: string }
  | { type: 'answered'; result: AnswerResult }
  | { type: 'next' }
  | { type: 'finish' }
  | { type: 'finished'; summary: SessionSummary }
  | { type: 'failed'; kind: FailureKind }
  | { type: 'retry' }

// Is there enough to send? (The server grades; this only avoids empty sends.)
export const isAnswerable = (step: Step, draft: StepResponse | null): boolean => {
  if (!draft) return false
  switch (step.type) {
    case 'mcq':
    case 'listen_choose':
      return 'option_id' in draft && draft.option_id !== ''
    case 'gap_fill':
      return (
        'values' in draft &&
        step.gaps.every((gap) => (draft.values[gap.gap_id] ?? '').trim() !== '')
      )
    case 'reorder':
      return 'token_ids' in draft && draft.token_ids.length === step.tokens.length
    case 'match':
      return 'pairs' in draft && step.left.every((l) => draft.pairs.some(([a]) => a === l.id))
    case 'short_answer':
      return 'text' in draft && draft.text.trim() !== ''
    case 'dialogue_turn':
      return (
        ('option_id' in draft && draft.option_id !== '') ||
        ('text' in draft && draft.text.trim() !== '')
      )
  }
}

export const sessionReducer = (state: SessionState, event: SessionEvent): SessionState => {
  switch (event.type) {
    case 'start':
      return state.phase === 'idle' || state.phase === 'error'
        ? { ...initialSession, phase: 'starting' }
        : state
    case 'started':
      if (state.phase !== 'starting') return state
      return {
        ...state,
        phase: 'step',
        sessionId: event.start.session_id,
        preview: event.start.preview,
        step: event.start.step,
        progress: event.start.progress,
        draft: null,
        failure: null,
        failedAt: null,
      }
    case 'draft':
      return state.phase === 'step' ? { ...state, draft: event.response } : state
    case 'submit':
      // Only an answerable step is sent; a second press while checking is ignored.
      if (state.phase !== 'step' || !state.step || !isAnswerable(state.step, state.draft))
        return state
      return { ...state, phase: 'checking', attemptId: event.attemptId, failure: null }
    case 'answered':
      if (state.phase !== 'checking') return state
      return { ...state, phase: 'feedback', result: event.result, progress: event.result.progress }
    case 'next': {
      if (state.phase !== 'feedback' || !state.result?.next_step) return state
      return {
        ...state,
        phase: 'step',
        step: state.result.next_step,
        draft: null,
        attemptId: null,
        result: null,
      }
    }
    case 'finish':
      return state.phase === 'feedback' && state.result && state.result.next_step === null
        ? { ...state, phase: 'finishing' }
        : state
    case 'finished':
      return state.phase === 'finishing'
        ? { ...state, phase: 'summary', summary: event.summary }
        : state
    case 'failed': {
      const at =
        state.phase === 'starting'
          ? 'start'
          : state.phase === 'checking'
            ? 'answer'
            : state.phase === 'finishing'
              ? 'finish'
              : null
      return at ? { ...state, phase: 'error', failure: event.kind, failedAt: at } : state
    }
    case 'retry': {
      if (state.phase !== 'error') return state
      if (state.failedAt === 'start') return { ...initialSession, phase: 'starting' }
      // Same attempt_id and same draft: the repeat is idempotent.
      if (state.failedAt === 'answer') return { ...state, phase: 'checking', failure: null }
      if (state.failedAt === 'finish') return { ...state, phase: 'finishing', failure: null }
      return state
    }
  }
}

// ---- Draft helpers shared by the step views ---------------------------------------

const idsOf = (draft: StepResponse | null) => (draft && 'token_ids' in draft ? draft.token_ids : [])
const pairsOf = (draft: StepResponse | null) => (draft && 'pairs' in draft ? draft.pairs : [])

// Reorder: tap a token to place it at the end, tap a placed one to take it back.
export const placeToken = (draft: StepResponse | null, tokenId: string): StepResponse => {
  const ids = idsOf(draft)
  return { token_ids: ids.includes(tokenId) ? ids : [...ids, tokenId] }
}
export const removeToken = (draft: StepResponse | null, tokenId: string): StepResponse => ({
  token_ids: idsOf(draft).filter((id) => id !== tokenId),
})

// Match: select one on each side; a pair replaces any earlier one on either side.
export const placePair = (
  draft: StepResponse | null,
  left: string,
  right: string
): StepResponse => ({ pairs: pairUp(pairsOf(draft), left, right) })
export const removePair = (draft: StepResponse | null, left: string): StepResponse => ({
  pairs: unpair(pairsOf(draft), left),
})

export const setGap = (draft: StepResponse | null, gapId: string, value: string): StepResponse => ({
  values: { ...(draft && 'values' in draft ? draft.values : {}), [gapId]: value },
})
