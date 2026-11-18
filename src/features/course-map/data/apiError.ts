import type { ApiErrorDetail } from './types.ts'

// Kept apart from client.ts, which reads the build environment when it loads, so
// pure modules (and their tests) can recognize an API failure without it.
// The backend answers `{ "detail": { code, message, ... } }` (FastAPI); the mock
// and older code paths put the business error at the top level. Accept both.
const unwrapDetail = (body: unknown): unknown => {
  if (body && typeof body === 'object' && 'detail' in body) {
    const inner = (body as { detail: unknown }).detail
    if (inner && typeof inner === 'object') return inner
  }
  return body
}

export class ApiError extends Error {
  readonly status: number
  readonly body: unknown
  // The request that failed, as `GET /trainer/catalog` (path without the API base). Set by
  // the HTTP client; absent on errors made locally (the mock API).
  readonly endpoint?: string

  constructor(status: number, body: unknown, endpoint?: string) {
    super(`Request failed with status ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.body = body
    this.endpoint = endpoint
  }

  // Business errors use `detail = { code, message, ...extras }`. Falls back
  // to a generic code when the body doesn't match that shape (network
  // errors, plain-text 5xx responses, etc).
  get detail(): ApiErrorDetail {
    const body = unwrapDetail(this.body)
    if (body && typeof body === 'object' && 'code' in body && 'message' in body) {
      return body as ApiErrorDetail
    }
    return { code: 'unknown_error', message: typeof body === 'string' ? body : this.message }
  }
}

// A route the server does not have answers 404, 405 or 501 with no business code in the
// body. A coded 404 (a level or an import that does not exist) is a real answer from a
// backend that does know the route.
export const isMissingRoute = (error: unknown): boolean =>
  error instanceof ApiError &&
  [404, 405, 501].includes(error.status) &&
  error.detail.code === 'unknown_error'
