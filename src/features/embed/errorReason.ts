// Short, plain-text reasons for `rumbos:error.detail` and the console warning.
// They name the kind of failure only: never an assertion, a token, a URL or any
// part of a response body.

// A backend business code (like "launch_invalid") is a short identifier; anything
// else in a body is free text and is left out.
const SAFE_CODE = /^[a-z0-9_.-]{1,40}$/

export const describeHttpFailure = (status: number, code?: unknown): string => {
  if (status === 0) return 'network error'
  const safe = typeof code === 'string' && SAFE_CODE.test(code) ? code : 'http_error'
  return `${safe} (HTTP ${status})`
}

export const REASONS = {
  malformedLaunch: 'malformed launch response',
  hostOriginMismatch: 'host origin mismatch',
  courseMismatch: 'course id mismatch',
  handshakeTimeout: 'no host-init within 15 s',
  hostSilent: 'host did not answer request-launch',
  identityChanged: 'launch identity changed',
  unexpected: 'unexpected error',
} as const
