import type { AppMessage, ReportedErrorCode } from './protocol.ts'

// What reportToHost needs of the host bridge.
interface HostSink {
  send(message: AppMessage): void
}

// Which failures may be reported to the host with `rumbos:error`. The host
// answers an error by dropping the map and showing the standard course content,
// so only failures that leave the map unusable as a whole may escalate. A
// failing secondary feature (a panel, a list, a save) is handled where it
// happens and the rest of the app keeps working.

export type FailureKind =
  // The conversation with the host could not be set up or is not understood.
  | 'handshake'
  | 'protocol_mismatch'
  // The first POST /auth/launch failed (invalid, tenant disabled, backend down).
  | 'launch'
  // The token expired and no new one could be obtained.
  | 'token_refresh'
  // A render crash caught by the error boundary.
  | 'crash'
  // Any API answer on a feature: 4xx, 5xx or no response.
  | 'feature_api_error'
  // 501 moodle_source_not_provided: a Moodle-backed endpoint called in embed mode.
  // A programming error, never the host's problem.
  | 'moodle_source_not_provided'

const ESCALATES: Record<FailureKind, boolean> = {
  handshake: true,
  protocol_mismatch: true,
  launch: true,
  token_refresh: true,
  crash: true,
  feature_api_error: false,
  moodle_source_not_provided: false,
}

export const escalatesToHost = (kind: FailureKind): boolean => ESCALATES[kind]

// What an API failure on a feature is, for the local handling.
export const classifyFeatureError = (status: number, code?: unknown): FailureKind =>
  status === 501 && code === 'moodle_source_not_provided'
    ? 'moodle_source_not_provided'
    : 'feature_api_error'

// The one way to send `rumbos:error`: a kind the policy keeps local is not sent.
export const reportToHost = (
  bridge: HostSink,
  kind: FailureKind,
  code: ReportedErrorCode,
  detail?: string
): boolean => {
  if (!escalatesToHost(kind)) return false
  bridge.send({ type: 'rumbos:error', v: 1, code, detail })
  return true
}
