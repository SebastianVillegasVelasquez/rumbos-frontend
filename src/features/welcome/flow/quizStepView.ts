import { es } from '../../../i18n/es.ts'
import { escapeVisible, isChecking, type CheckOutcome, type CheckinState } from './quizCheckin.ts'
import type { QuizGate } from './flowReducer.ts'
import { classifyQuiz, confirmsCompletion, type QuizKind } from './quizOutcome.ts'

const text = es.flow.quiz

// What the quiz step shows, as data: which message, how the check button reads and
// whether it is enabled, the line with the last check, and whether the exit is on
// screen. Pure, so the feedback rules ("Comprobar de nuevo" always visibly does
// something, the exit never before its time) are tested without a browser.

export type QuizMessage =
  'not_started' | 'in_progress' | 'waiting' | 'non_student' | 'not_graded' | 'finished'

export interface QuizStepView {
  message: QuizMessage | null
  openLabel: string
  checkLabel: string
  // Disabled only while a request is pending.
  checkDisabled: boolean
  // A request is out: the spinner shows.
  checking: boolean
  // "Última comprobación: ..." or the timeout notice; null before the first answer.
  statusLine: string | null
  escape: boolean
  editorNote: boolean
}

const MESSAGE_OF: Record<QuizKind, QuizMessage> = {
  finished: 'finished',
  non_student: 'non_student',
  not_graded: 'not_graded',
  in_progress: 'in_progress',
  none: 'not_started',
  unknown: 'waiting',
}

export const agoText = (elapsedMs: number): string => {
  const minutes = Math.floor(Math.max(0, elapsedMs) / 60_000)
  return minutes < 1 ? text.ago.seconds : text.ago.minutes(minutes)
}

const summaryOf = (outcome: CheckOutcome): string => {
  if (outcome.kind === 'error') return text.summary.error
  if (outcome.kind === 'timeout') return text.summary.timeout
  const parts = [text.summary.finished(outcome.finishedAttempts)]
  if (outcome.inProgress) parts.push(text.summary.inProgress)
  if (outcome.previewAttempts > 0) parts.push(text.summary.preview(outcome.previewAttempts))
  return parts.join(', ')
}

export const quizStepView = (input: {
  gate: QuizGate
  checkin: CheckinState
  editor: boolean
}): QuizStepView => {
  const { gate, checkin, editor } = input
  const checking = isChecking(checkin)
  const result = gate.kind === 'result' ? gate.result : null
  const kind = result ? classifyQuiz(result) : null
  const last = checkin.last
  const statusLine = !last
    ? null
    : last.outcome.kind === 'timeout'
      ? text.timeout
      : text.lastCheck(agoText(checkin.now - last.at), summaryOf(last.outcome))
  return {
    message: kind ? MESSAGE_OF[kind] : null,
    openLabel: kind === 'in_progress' ? text.resume : text.start,
    checkLabel: checking ? text.checking : text.checkAgain,
    checkDisabled: checking,
    checking,
    statusLine,
    // Nobody who is already free to go (a confirmed result, the editing role) is
    // offered the exit.
    escape: !editor && !(result && confirmsCompletion(result)) && escapeVisible(checkin),
    editorNote: editor && !(result && confirmsCompletion(result)),
  }
}
