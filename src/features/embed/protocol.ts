// The postMessage protocol between the Moodle plugin (host page) and this app
// (the iframe). Contract v5, always `v: 1`. Everything crossing the boundary
// is untrusted: incoming messages are parsed by hand-written guards that
// either return a clean, size-bounded value or null (ignore the message).
// Host-provided text is plain text: it is only ever rendered as a React text
// node, never as HTML.

export const EMBED_PROTOCOL_VERSION = 1

// ---- Limits -----------------------------------------------------------------

export const MAX_ASSERTION_LENGTH = 8_192
const MAX_SECTIONS = 500
const MAX_ACTIVITIES = 3_000
const MAX_UNAVAILABLE = 3_000
const MAX_NAME_LENGTH = 400
const MAX_INFO_LENGTH = 1_500
const MAX_SHORT_LENGTH = 64

// ---- Course state ----------------------------------------------------------------

export type HostAvailability = 'available' | 'restricted' | 'hidden'

export type HostCompletion = 'none' | 'incomplete' | 'complete' | 'failed'

export interface HostSection {
  id: number
  number: number
  name: string
}

export interface HostActivity {
  cmid: number
  name: string
  modname: string
  sectionId: number
  availability: HostAvailability
  // Plain text.
  availabilityInfo: string | null
  completion: HostCompletion
}

// The contract also carries a `url` per activity. It is deliberately dropped
// while parsing: the app never opens or passes URLs, opening an activity sends
// its cmid and the host looks the URL up in its own state.
export interface CourseState {
  schemaVersion: 1
  courseId: number
  generatedAt: string
  sections: HostSection[]
  activities: HostActivity[]
  // Activities that exist but this user cannot see at all.
  unavailableCmids: number[]
}

// ---- Messages ---------------------------------------------------------------------

export type HostMode = 'student' | 'editor'

export interface HostInitMessage {
  type: 'rumbos:host-init'
  v: 1
  mode: HostMode
  locale: string
  courseId: number
  // Opaque to the app: handed to the backend untouched, never logged.
  assertion: string
  state: CourseState
}

export interface HostStateMessage {
  type: 'rumbos:host-state'
  v: 1
  state: CourseState
}

export interface HostLaunchMessage {
  type: 'rumbos:host-launch'
  v: 1
  assertion: string
}

export interface HostFullscreenMessage {
  type: 'rumbos:host-fullscreen'
  v: 1
  on: boolean
}

export type HostMessage =
  HostInitMessage | HostStateMessage | HostLaunchMessage | HostFullscreenMessage

// Why the app gave up. The plugin uses it to fall back to the standard course
// content, so a student is never left on a dead page.
export type EmbedErrorCode =
  | 'not_embedded'
  | 'invalid_host'
  | 'handshake_timeout'
  | 'launch_invalid'
  | 'tenant_disabled'
  | 'origin_mismatch'
  | 'course_mismatch'
  | 'backend_unreachable'
  | 'session_expired'

// The only codes the plugin understands on the wire (contract v5.1). The
// internal EmbedErrorCode set is finer-grained and drives the in-app messages;
// toWireErrorCode is the single place that maps one onto the other.
export type WireErrorCode =
  'launch_failed' | 'token_refresh_failed' | 'app_crashed' | 'protocol_unsupported'

export type ReportedErrorCode = EmbedErrorCode | WireErrorCode

export const MAX_ERROR_DETAIL_LENGTH = 200

const WIRE_ERROR_CODES: readonly string[] = [
  'launch_failed',
  'token_refresh_failed',
  'app_crashed',
  'protocol_unsupported',
]

// not_embedded, invalid_host, handshake_timeout, launch_invalid, tenant_disabled,
// origin_mismatch, course_mismatch, backend_unreachable -> launch_failed
// session_expired                                        -> token_refresh_failed
// the four wire codes                                    -> themselves
// anything else (unknown)                                -> launch_failed
export const toWireErrorCode = (code: string): WireErrorCode => {
  if (WIRE_ERROR_CODES.includes(code)) return code as WireErrorCode
  if (code === 'session_expired') return 'token_refresh_failed'
  return 'launch_failed'
}

export type AppMessage =
  | { type: 'rumbos:embed-ready'; v: 1 }
  | { type: 'rumbos:request-state'; v: 1 }
  | { type: 'rumbos:request-launch'; v: 1 }
  | { type: 'rumbos:open-activity'; v: 1; cmid: number }
  | { type: 'rumbos:request-fullscreen'; v: 1; on: boolean }
  | { type: 'rumbos:error'; v: 1; code: ReportedErrorCode; detail?: string }

// What actually crosses the boundary: error codes are mapped to the wire set
// and the detail is cut to plain text of at most 200 characters.
export const toWireMessage = (message: AppMessage): unknown => {
  if (message.type !== 'rumbos:error') return message
  const wire: { type: 'rumbos:error'; v: 1; code: WireErrorCode; detail?: string } = {
    type: 'rumbos:error',
    v: 1,
    code: toWireErrorCode(message.code),
  }
  const detail = cleanText(message.detail, MAX_ERROR_DETAIL_LENGTH)
  if (detail) wire.detail = detail
  return wire
}

// ---- Guards -------------------------------------------------------------------------

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0

const isPositiveId = (value: unknown): value is number => isId(value) && value > 0

// Drops control characters (keeps tab and newline) and caps the length, so a
// hostile or buggy host cannot flood the UI. The result is still just text.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F]/g

export const cleanText = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string') return null
  // Slice first so a huge string never goes through the regex.
  const cleaned = value.slice(0, max * 2).replace(CONTROL_CHARS, '')
  return cleaned.length > max ? cleaned.slice(0, max) : cleaned
}

const AVAILABILITIES: readonly string[] = ['available', 'restricted', 'hidden']
const COMPLETIONS: readonly string[] = ['none', 'incomplete', 'complete', 'failed']

const parseSection = (value: unknown): HostSection | null => {
  if (!isRecord(value) || !isId(value.id) || !isId(value.number)) return null
  const name = cleanText(value.name, MAX_NAME_LENGTH)
  return name === null ? null : { id: value.id, number: value.number, name }
}

const parseActivity = (value: unknown): HostActivity | null => {
  if (!isRecord(value) || !isPositiveId(value.cmid) || !isId(value.sectionId)) return null
  const name = cleanText(value.name, MAX_NAME_LENGTH)
  const modname = cleanText(value.modname, MAX_SHORT_LENGTH)
  if (name === null || modname === null) return null
  if (typeof value.availability !== 'string' || !AVAILABILITIES.includes(value.availability))
    return null
  if (typeof value.completion !== 'string' || !COMPLETIONS.includes(value.completion)) return null
  if (value.url !== null && value.url !== undefined && typeof value.url !== 'string') return null
  if (
    value.availabilityInfo !== null &&
    value.availabilityInfo !== undefined &&
    typeof value.availabilityInfo !== 'string'
  )
    return null
  const info =
    typeof value.availabilityInfo === 'string'
      ? cleanText(value.availabilityInfo, MAX_INFO_LENGTH)
      : null
  return {
    cmid: value.cmid,
    name,
    modname,
    sectionId: value.sectionId,
    availability: value.availability as HostAvailability,
    availabilityInfo: info,
    completion: value.completion as HostCompletion,
  }
}

const parseList = <T>(
  value: unknown,
  max: number,
  parseItem: (item: unknown) => T | null
): T[] | null => {
  if (!Array.isArray(value) || value.length > max) return null
  const items: T[] = []
  for (const raw of value) {
    const item = parseItem(raw)
    if (item === null) return null
    items.push(item)
  }
  return items
}

// A malformed entry rejects the whole state: applying half of it could show a
// student a wrong lock or completion.
export const parseCourseState = (value: unknown): CourseState | null => {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isPositiveId(value.courseId)) return null
  const generatedAt = cleanText(value.generatedAt, MAX_SHORT_LENGTH)
  const sections = parseList(value.sections, MAX_SECTIONS, parseSection)
  const activities = parseList(value.activities, MAX_ACTIVITIES, parseActivity)
  const unavailable = parseList(value.unavailableCmids, MAX_UNAVAILABLE, (item) =>
    isPositiveId(item) ? item : null
  )
  if (generatedAt === null || !sections || !activities || !unavailable) return null

  const seen = new Set<number>()
  const unique = activities.filter((activity) => {
    if (seen.has(activity.cmid)) return false
    seen.add(activity.cmid)
    return true
  })
  return {
    schemaVersion: 1,
    courseId: value.courseId,
    generatedAt,
    sections,
    activities: unique,
    unavailableCmids: unavailable,
  }
}

const parseAssertion = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 && value.length <= MAX_ASSERTION_LENGTH
    ? value
    : null

export const parseHostMessage = (data: unknown): HostMessage | null => {
  if (!isRecord(data) || data.v !== EMBED_PROTOCOL_VERSION) return null
  switch (data.type) {
    case 'rumbos:host-init': {
      const state = parseCourseState(data.state)
      const assertion = parseAssertion(data.assertion)
      const locale = cleanText(data.locale, MAX_SHORT_LENGTH)
      if (!state || !assertion || locale === null || !isPositiveId(data.courseId)) return null
      if (data.mode !== 'student' && data.mode !== 'editor') return null
      if (state.courseId !== data.courseId) return null
      return {
        type: 'rumbos:host-init',
        v: 1,
        mode: data.mode,
        locale,
        courseId: data.courseId,
        assertion,
        state,
      }
    }
    case 'rumbos:host-state': {
      const state = parseCourseState(data.state)
      return state ? { type: 'rumbos:host-state', v: 1, state } : null
    }
    case 'rumbos:host-launch': {
      const assertion = parseAssertion(data.assertion)
      return assertion ? { type: 'rumbos:host-launch', v: 1, assertion } : null
    }
    case 'rumbos:host-fullscreen':
      return typeof data.on === 'boolean'
        ? { type: 'rumbos:host-fullscreen', v: 1, on: data.on }
        : null
    default:
      return null
  }
}
