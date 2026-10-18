import type { ApiErrorDetail } from './types.ts'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

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

// Embed mode authenticates with a bearer token held in memory by the embed
// session (see features/embed). Standalone never installs hooks, so its
// requests are unchanged and none of the embed code is loaded.
export interface AuthHooks {
  getToken(): string | null
  // Gets a fresh token from the host; resolves true once one is in place.
  // Concurrent callers share one refresh.
  refresh(): Promise<boolean>
}

let authHooks: AuthHooks | null = null

export const setAuthHooks = (hooks: AuthHooks | null) => {
  authHooks = hooks
}

export const hasAuthHooks = () => authHooks !== null

export const getAuthToken = () => authHooks?.getToken() ?? null

// Runs a call that reports 401 as an ApiError (the mock API, which has no
// HTTP layer) and repeats it once after a successful token refresh.
export const retryOnUnauthorized = async <T>(run: () => Promise<T>): Promise<T> => {
  try {
    return await run()
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 401 &&
      authHooks &&
      (await authHooks.refresh())
    )
      return run()
    throw error
  }
}

// Status 0 means the request never got a response (backend down, network).
export const isUnreachable = (error: unknown) => error instanceof ApiError && error.status === 0

// 412 version_conflict: someone else changed the guarded resource first.
export const isVersionConflict = (error: unknown) =>
  error instanceof ApiError && error.status === 412

// 428 precondition_required: the client forgot If-Match. Always a client bug.
export const isPreconditionRequired = (error: unknown) =>
  error instanceof ApiError && error.status === 428

const parseBody = (text: string): unknown => {
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

// Guarded endpoints (contract v3) take the revision/version the client last
// saw as a quoted-number If-Match header.
const ifMatchHeader = (ifMatch: number) => `"${ifMatch}"`

export async function apiRequest<T>(
  path: string,
  options: { method?: string; body?: unknown; ifMatch?: number; auth?: boolean } = {}
): Promise<T> {
  const { method = 'GET', body, ifMatch, auth = true } = options
  const attempt = async (): Promise<Response> => {
    const headers: Record<string, string> = {}
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (ifMatch !== undefined) headers['If-Match'] = ifMatchHeader(ifMatch)
    const token = auth ? authHooks?.getToken() : null
    if (token) headers['Authorization'] = `Bearer ${token}`
    try {
      return await fetch(`${API_BASE_URL}${path}`, {
        method,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        // Token auth only: never send the (third-party) cookies along.
        credentials: authHooks ? 'omit' : undefined,
      })
    } catch {
      throw new ApiError(0, undefined)
    }
  }

  let response = await attempt()
  // The token expired: get a new one from the host and retry exactly once.
  // Callers that run inside the write queue hold the queue while this waits,
  // so no later write overtakes the retried one.
  if (response.status === 401 && auth && authHooks && (await authHooks.refresh())) {
    response = await attempt()
  }

  if (response.status === 204) return undefined as T

  const parsed = parseBody(await response.text())
  if (!response.ok) throw new ApiError(response.status, parsed)
  return parsed as T
}

// Multipart upload for /assets. Separate from apiRequest because the body is
// FormData, not JSON (no Content-Type header: the browser sets the boundary).
// Uses XMLHttpRequest rather than fetch because only XHR reports upload
// progress. Also reports the HTTP status, since /assets answers 201 for new
// content and 200 when identical content already existed.
export function apiUpload<T>(
  path: string,
  form: FormData,
  onProgress?: (fraction: number) => void
): Promise<{ data: T; status: number }> {
  const attempt = () =>
    new Promise<{ data: T; status: number }>((resolve, reject) => {
      const request = new XMLHttpRequest()
      request.open('POST', `${API_BASE_URL}${path}`)
      const token = authHooks?.getToken()
      if (token) request.setRequestHeader('Authorization', `Bearer ${token}`)
      if (onProgress) {
        request.upload.onprogress = (event) => {
          if (event.lengthComputable) onProgress(event.loaded / event.total)
        }
      }
      request.onerror = () => reject(new ApiError(0, undefined))
      request.onabort = () => reject(new ApiError(0, undefined))
      request.onload = () => {
        const parsed = parseBody(request.responseText)
        if (request.status >= 200 && request.status < 300)
          resolve({ data: parsed as T, status: request.status })
        else reject(new ApiError(request.status, parsed))
      }
      request.send(form)
    })

  return attempt().catch(async (error: unknown) => {
    if (
      error instanceof ApiError &&
      error.status === 401 &&
      authHooks &&
      (await authHooks.refresh())
    )
      return attempt()
    throw error
  })
}
