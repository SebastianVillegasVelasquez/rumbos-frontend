import type { ApiErrorDetail } from './types.ts'

// Kept apart from client.ts, which reads the build environment when it loads, so
// pure modules (and their tests) can recognize an API failure without it.
export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, body: unknown) {
    super(`Request failed with status ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }

  // Business errors use `detail = { code, message, ...extras }`. Falls back
  // to a generic code when the body doesn't match that shape (network
  // errors, plain-text 5xx responses, etc).
  get detail(): ApiErrorDetail {
    const body = this.body
    if (body && typeof body === 'object' && 'code' in body && 'message' in body) {
      return body as ApiErrorDetail
    }
    return { code: 'unknown_error', message: typeof body === 'string' ? body : this.message }
  }
}
