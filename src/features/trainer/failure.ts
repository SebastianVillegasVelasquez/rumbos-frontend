import { ApiError, isMissingRoute } from '../course-map/data/apiError.ts'
import type { FailureKind } from './sessionReducer.ts'

// What went wrong, in the terms the practice screens have copy for. A missing route is
// told apart first: the screen says one thing to everyone, the console says which route.
export const classifyFailure = (error: unknown): FailureKind => {
  if (!(error instanceof ApiError)) return 'other'
  if (isMissingRoute(error)) {
    console.error(
      `Contract violation at ${error.endpoint ?? 'an unknown request'}: ` +
        `the backend answered ${error.status}, it has no such route`
    )
    return 'contract'
  }
  if (error.status === 0) return 'unreachable'
  if (error.status === 401) return 'unauthorized'
  // Unknown, closed or disabled for this map.
  if (error.status === 404 || error.status === 403) return 'closed'
  // The session is not in a state that accepts this call (already finished, answered
  // from another tab). It is about this practice, never about an exam.
  if (error.status === 409) return 'conflict'
  if (error.status >= 500 || error.status === 429) return 'unreachable'
  return 'other'
}
