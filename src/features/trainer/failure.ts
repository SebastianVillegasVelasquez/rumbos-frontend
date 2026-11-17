import { ApiError } from '../course-map/data/apiError.ts'
import type { FailureKind } from './sessionReducer.ts'

// What went wrong, in the terms the practice screens have copy for. Pure.
export const classifyFailure = (error: unknown): FailureKind => {
  if (!(error instanceof ApiError)) return 'other'
  if (error.status === 0) return 'unreachable'
  if (error.status === 401) return 'unauthorized'
  // Unknown, closed or disabled for this map.
  if (error.status === 404 || error.status === 403 || error.status === 409) return 'closed'
  if (error.status >= 500 || error.status === 429) return 'unreachable'
  return 'other'
}
