import type { WelcomeStep, WelcomeStepType } from '../../course-map/data/types.ts'
import type { FlowMethod, FlowProgressItem, QuizResult } from '../../embed/protocol.ts'

// What the flow needs of a progress record: the host also sends when it was
// completed, a local flag does not.
export type ProgressEntry = Omit<FlowProgressItem, 'completedAt'>
import {
  initialVideoState,
  takeVideoFallback,
  videoCompleted,
  videoReducer,
  type VideoEvent,
  type VideoState,
} from './videoStepState.ts'

// The state machine of the welcome flow: which step is shown, what each step
// needs before "Continuar" enables, what counts as done. Pure (no React, no DOM,
// no clock, no host): the player feeds it events and reads the gate; persistence
// reads the completions it returns. This is what keeps gating apart from
// rendering.
//
// Modes: `normal` records completions; `review` (a finished flow reopened) has
// every step unlocked and records nothing; `preview` (the editor trying the flow)
// behaves like normal but the player never persists it.

export type FlowMode = 'normal' | 'review' | 'preview'

export interface FlowStepInfo {
  key: string
  type: WelcomeStepType
  mandatory: boolean
  revision: number
  // html and pdf: visible seconds required and whether an acknowledgement is.
  minSeconds: number
  needsAck: boolean
  // video steps: whether the way out exists.
  allowFallback: boolean
}

export const toStepInfo = (step: WelcomeStep): FlowStepInfo => ({
  key: step.key,
  type: step.type,
  mandatory: step.mandatory,
  revision: step.revision,
  minSeconds: step.type === 'html' || step.type === 'pdf' ? step.minSeconds : 0,
  needsAck: (step.type === 'html' || step.type === 'pdf') && step.ack !== null,
  allowFallback: step.type === 'video' ? step.allowFallback : false,
})

// Why a quiz step does not block. `unlinked`: the editor has not chosen a quiz;
// the rest come from the course state (restricted, hidden, missing) or from the
// host (not_found, unavailable, capability, or no answer at all).
export type QuizUnavailableReason =
  'unlinked' | 'restricted' | 'hidden' | 'missing' | 'not_found' | 'unavailable' | 'silent'

export type QuizGate =
  | { kind: 'pending' }
  | { kind: 'result'; result: QuizResult }
  | { kind: 'unavailable'; reason: QuizUnavailableReason }

export interface Completion {
  revision: number
  method: FlowMethod
}

export interface FlowState {
  mode: FlowMode
  steps: FlowStepInfo[]
  index: number
  // The furthest step the viewer may move to (dots ahead of it are not clickable).
  furthest: number
  // Completed steps, at the revision recorded. A step whose revision is raised
  // no longer counts (see isDone).
  done: Record<string, Completion>
  // Visible seconds counted per step.
  seconds: Record<string, number>
  acked: Record<string, boolean>
  video: Record<string, VideoState>
  quiz: Record<string, QuizGate>
  // The viewer went past the last step (or closed a review): the flow is over.
  finished: boolean
}

export const isDone = (state: FlowState, step: FlowStepInfo): boolean => {
  const entry = state.done[step.key]
  return entry !== undefined && entry.revision >= step.revision
}

// Mandatory steps that are not done at their current revision.
const firstPending = (steps: FlowStepInfo[], done: FlowState['done']): number => {
  const index = steps.findIndex(
    (step) => step.mandatory && !((done[step.key]?.revision ?? -1) >= step.revision)
  )
  return index
}

export const doneFromProgress = (items: readonly ProgressEntry[]): FlowState['done'] => {
  const done: FlowState['done'] = {}
  for (const item of items) {
    const previous = done[item.stepKey]
    if (!previous || item.revision >= previous.revision)
      done[item.stepKey] = { revision: item.revision, method: item.method }
  }
  return done
}

// Every mandatory step is done at its current revision. A flow without a
// mandatory step has no such record; see needsPresenceMark.
export const isFlowComplete = (steps: FlowStepInfo[], done: FlowState['done']): boolean =>
  steps.some((step) => step.mandatory) && firstPending(steps, done) === -1

export const createFlowState = (
  steps: FlowStepInfo[],
  items: readonly ProgressEntry[],
  mode: FlowMode
): FlowState => {
  const done = mode === 'normal' ? doneFromProgress(items) : {}
  // Resume at the first mandatory step not done at its current revision; when
  // everything is done (a review) start at the beginning.
  const pending = mode === 'review' ? -1 : firstPending(steps, done)
  const index = pending === -1 ? 0 : pending
  return {
    mode,
    steps,
    index,
    furthest: mode === 'review' ? Math.max(0, steps.length - 1) : index,
    done,
    seconds: {},
    acked: {},
    video: {},
    quiz: {},
    finished: false,
  }
}

// ---- Gating -------------------------------------------------------------------

export type WaitingFor = 'time' | 'ack' | 'video' | 'quiz' | 'time-and-ack'

export interface Gate {
  // The step's own condition is met (or it needs none).
  satisfied: boolean
  // How it completes when it does.
  method: FlowMethod
  waitingFor: WaitingFor | null
  secondsLeft: number
  // "Continuar" is enabled.
  canContinue: boolean
  // A non-mandatory step also offers "Saltar".
  canSkip: boolean
}

export const videoOf = (state: FlowState, key: string): VideoState =>
  state.video[key] ?? initialVideoState

export const quizOf = (state: FlowState, key: string): QuizGate =>
  state.quiz[key] ?? { kind: 'pending' }

export const gateOf = (state: FlowState, index: number = state.index): Gate => {
  const step = state.steps[index]
  const done = isDone(state, step)
  let satisfied = true
  let method: FlowMethod = 'completed'
  let waitingFor: WaitingFor | null = null
  let secondsLeft = 0

  switch (step.type) {
    case 'welcome':
      break
    case 'video': {
      const video = videoOf(state, step.key)
      satisfied = videoCompleted(video)
      if (video.usedFallback && video.phase !== 'ended') method = 'fallback'
      if (!satisfied) waitingFor = 'video'
      break
    }
    case 'html':
    case 'pdf': {
      secondsLeft = Math.max(0, step.minSeconds - (state.seconds[step.key] ?? 0))
      const needsTime = secondsLeft > 0
      const needsAck = step.needsAck && !state.acked[step.key]
      satisfied = !needsTime && !needsAck
      waitingFor =
        needsTime && needsAck ? 'time-and-ack' : needsTime ? 'time' : needsAck ? 'ack' : null
      break
    }
    case 'quiz': {
      const gate = quizOf(state, step.key)
      if (gate.kind === 'unavailable') {
        // Non-blocking, and recorded as such.
        method = 'unavailable'
      } else if (gate.kind === 'result' && gate.result.finishedAttempts >= 1) {
        // done
      } else {
        satisfied = false
        waitingFor = 'quiz'
      }
      break
    }
  }

  // A step already completed (at its revision) stays open when it is revisited.
  if (done) {
    satisfied = true
    waitingFor = null
    secondsLeft = 0
  }
  const unlocked = state.mode === 'review'
  return {
    satisfied,
    method,
    waitingFor,
    secondsLeft,
    // A mandatory step needs its condition; an optional one always continues.
    canContinue: unlocked || satisfied || !step.mandatory,
    canSkip: step.mandatory === false && !unlocked,
  }
}

// ---- Events --------------------------------------------------------------------

export type FlowEvent =
  // One second of the current step being visible (the tab visible too).
  | { type: 'tick' }
  | { type: 'ack'; checked: boolean }
  | { type: 'video'; event: VideoEvent }
  | { type: 'video-fallback' }
  | { type: 'quiz'; gate: QuizGate }
  | { type: 'next' }
  // "Saltar": leave an optional step without completing it.
  | { type: 'skip' }
  | { type: 'back' }
  | { type: 'goto'; index: number }
  // Progress that arrives after the flow started (a late host answer): it can
  // only add completions, never undo one.
  | { type: 'progress'; items: readonly ProgressEntry[] }
  // A review, a preview or a finished flow closed: the player can unmount.
  | { type: 'close' }

const replaceRecord = <T>(record: Record<string, T>, key: string, value: T) => ({
  ...record,
  [key]: value,
})

export const flowReducer = (state: FlowState, event: FlowEvent): FlowState => {
  if (state.finished) return state
  const step = state.steps[state.index]
  switch (event.type) {
    case 'tick':
      return step.type === 'html' || step.type === 'pdf'
        ? {
            ...state,
            seconds: replaceRecord(state.seconds, step.key, (state.seconds[step.key] ?? 0) + 1),
          }
        : state
    case 'ack':
      return step.needsAck
        ? { ...state, acked: replaceRecord(state.acked, step.key, event.checked) }
        : state
    case 'video': {
      if (step.type !== 'video') return state
      return {
        ...state,
        video: replaceRecord(
          state.video,
          step.key,
          videoReducer(videoOf(state, step.key), event.event)
        ),
      }
    }
    case 'video-fallback': {
      if (step.type !== 'video' || !step.allowFallback) return state
      const video = takeVideoFallback(videoOf(state, step.key))
      return { ...state, video: replaceRecord(state.video, step.key, video) }
    }
    case 'quiz':
      return step.type === 'quiz'
        ? { ...state, quiz: replaceRecord(state.quiz, step.key, event.gate) }
        : state
    case 'next':
    case 'skip': {
      const gate = gateOf(state)
      if (event.type === 'next' && !gate.canContinue) return state
      if (event.type === 'skip' && !gate.canSkip) return state
      // Done only when the step's own condition was met; a skipped optional step
      // leaves no record. Review records nothing.
      const record = event.type === 'next' && gate.satisfied && state.mode !== 'review'
      const done =
        record && !isDone(state, step)
          ? replaceRecord(state.done, step.key, { revision: step.revision, method: gate.method })
          : state.done
      const last = state.index >= state.steps.length - 1
      if (last) return { ...state, done, finished: true }
      const index = state.index + 1
      return { ...state, done, index, furthest: Math.max(state.furthest, index) }
    }
    case 'back':
      return state.index > 0 ? { ...state, index: state.index - 1 } : state
    case 'goto':
      return event.index >= 0 && event.index <= state.furthest && event.index < state.steps.length
        ? { ...state, index: event.index }
        : state
    case 'progress': {
      if (state.mode !== 'normal') return state
      const incoming = doneFromProgress(event.items)
      const done = { ...state.done }
      for (const [key, value] of Object.entries(incoming))
        if (!done[key] || value.revision > done[key].revision) done[key] = value
      return { ...state, done }
    }
    case 'close':
      return { ...state, finished: true }
  }
}

// What the transition made newly done: these are what gets sent to the host
// (flow-step-done). Only in normal mode, and only mandatory steps, plus the
// presence mark below. Review and preview never produce any.
export interface NewCompletion {
  stepKey: string
  revision: number
  method: FlowMethod
}

export const newCompletions = (previous: FlowState, next: FlowState): NewCompletion[] => {
  if (next.mode !== 'normal') return []
  const out: NewCompletion[] = []
  for (const step of next.steps) {
    const before = previous.done[step.key]
    const after = next.done[step.key]
    if (!after || (before && before.revision >= after.revision && before.method === after.method))
      continue
    // Optional steps are not reported: only what the viewer had to do counts.
    if (step.mandatory)
      out.push({ stepKey: step.key, revision: after.revision, method: after.method })
  }
  // A flow with no mandatory step would show on every visit: when it is
  // finished, its last step is reported once as a presence mark.
  if (!previous.finished && next.finished && !next.steps.some((step) => step.mandatory)) {
    const last = next.steps[next.steps.length - 1]
    if (last) out.push({ stepKey: last.key, revision: last.revision, method: 'completed' })
  }
  return out
}

// What the host must remember about a finished flow: complete when every
// mandatory step is done, or (no mandatory step) the last step has its mark.
export const isComplete = (steps: FlowStepInfo[], items: readonly ProgressEntry[]): boolean => {
  const done = doneFromProgress(items)
  if (steps.some((step) => step.mandatory)) return isFlowComplete(steps, done)
  const last = steps[steps.length - 1]
  return last !== undefined && (done[last.key]?.revision ?? -1) >= last.revision
}
