import type { FlowMethod, QuizResult } from '../../embed/protocol.ts'

// What a quiz result means for the step, free of React and of the clock. The step
// is a mandatory convention, never a lock: every cause that keeps a viewer from
// finishing the quiz has an exit that is recorded as such.

// What the answer says about the viewer and the quiz.
//   finished      the attempt is handed in.
//   non_student   a role that cannot take the quiz (a teacher's preview).
//   not_graded    handed in, waiting for a grader.
//   in_progress   an attempt is open and not sent.
//   none          no attempt yet.
//   unknown       an older plugin: zero finished attempts and nothing else to go on.
export type QuizKind =
  'finished' | 'non_student' | 'not_graded' | 'in_progress' | 'none' | 'unknown'

export const classifyQuiz = (result: QuizResult): QuizKind => {
  switch (result.reason) {
    case 'ok':
      return 'finished'
    case 'preview_only':
    case 'cannot_attempt':
      return 'non_student'
    case 'not_graded_yet':
      return 'not_graded'
    case 'in_progress':
      return 'in_progress'
    case 'no_attempts':
      return 'none'
    case undefined:
      break
  }
  // No reason (a plugin that predates v5.9): the counts, as before. A role the
  // plugin says cannot attempt never gets a count, so it is not a student's wait.
  if (result.canAttempt === false) return 'non_student'
  if (result.finishedAttempts >= 1) return 'finished'
  if (result.inProgress) return 'in_progress'
  return 'unknown'
}

export interface QuizOutcome {
  // The step may be left.
  satisfied: boolean
  // How it is recorded when it is.
  method: FlowMethod
}

const BLOCKED: QuizOutcome = { satisfied: false, method: 'completed' }

// `completed` only when the quiz was handed in; everything else that lets the
// viewer go on is a `fallback` (or `unavailable` when the quiz cannot be asked).
export const outcomeOfResult = (result: QuizResult): QuizOutcome => {
  switch (classifyQuiz(result)) {
    case 'finished':
      return { satisfied: true, method: 'completed' }
    case 'non_student':
      return { satisfied: true, method: 'fallback' }
    // Handed in and waiting for a grader: completed when there is a finished
    // attempt to point at (the plugin says so), a fallback when there is none.
    case 'not_graded':
      return { satisfied: true, method: result.finishedAttempts >= 1 ? 'completed' : 'fallback' }
    case 'in_progress':
    case 'none':
    case 'unknown':
      return BLOCKED
  }
}

// Whether a result confirms the quiz is done (what a check is looking for).
export const confirmsCompletion = (result: QuizResult): boolean => outcomeOfResult(result).satisfied
