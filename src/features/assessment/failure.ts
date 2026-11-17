import { ApiError } from '../course-map/data/apiError.ts'
import type { FailureKind } from './examReducer.ts'

// What went wrong, in the terms the runner has copy for. Pure.
export const classifyFailure = (error: unknown): FailureKind => {
  if (!(error instanceof ApiError)) return 'other'
  if (error.status === 0) return 'unreachable'
  if (error.status === 401) return 'unauthorized'
  if (error.status === 409) {
    const code = error.detail.code
    if (code === 'no_attempts_left') return 'no_attempts_left'
    if (code === 'locked') return 'locked'
    // submitted or expired: the attempt is over.
    return 'closed'
  }
  // A server that is down or overloaded is, for the student, unreachable.
  if (error.status >= 500 || error.status === 429) return 'unreachable'
  return 'other'
}
