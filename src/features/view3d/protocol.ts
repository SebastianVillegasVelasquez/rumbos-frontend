// postMessage protocol v1 between the host app and the 3D page (/3d/).
// Documented in docs/3d/BRIDGE.md. This file is the single definition: the
// page's bridge (3d/main.ts) and the host hook (useView3dBridge.ts) both
// import it, so the two sides cannot drift apart.
//
// Everything arriving through postMessage is untrusted until it passes a guard
// here. Guards check shape and size only; origin and source are checked by
// the callers, who know which window they expect.

export const PROTOCOL_VERSION = 1

export type PinState = 'locked' | 'available' | 'next' | 'complete' | 'teaser' | 'missing'
export type Locale3d = 'es' | 'en'

// A null title or description means "use the scene's built-in text".
export interface Point3D {
  // The bubble id.
  id: string
  zoneId: number
  title: string | null
  description: string | null
  state: PinState
}

export type CssVars = Record<string, string>

// ---- 3D page -> host ---------------------------------------------------------

export type PageMessage =
  | { type: 'rumbos:ready'; v: 1 }
  | { type: 'rumbos:pin-click'; v: 1; pointId: string }
  | { type: 'rumbos:open-activity'; v: 1; pointId: string }
  | { type: 'rumbos:error'; v: 1; code: string; message: string }

// ---- host -> 3D page ---------------------------------------------------------

export type HostMessage =
  | {
      type: 'rumbos:init'
      v: 1
      scene: string
      locale: Locale3d
      reducedMotion: boolean
      theme: { cssVars: CssVars }
      points: Point3D[]
    }
  | { type: 'rumbos:states'; v: 1; states: Record<string, PinState> }
  | { type: 'rumbos:locale'; v: 1; locale: Locale3d }
  | { type: 'rumbos:theme'; v: 1; cssVars: CssVars }
  | { type: 'rumbos:focus'; v: 1; pointId: string }

export const PIN_STATES: readonly PinState[] = [
  'locked',
  'available',
  'next',
  'complete',
  'teaser',
  'missing',
]

// Hard limits. The scene decides how many zones really exist (9 for
// region-encuentros); these only bound what a malformed message can cost.
export const MAX_POINTS = 32
const MAX_ID_LENGTH = 100
const MAX_TITLE_LENGTH = 500
const MAX_DESCRIPTION_LENGTH = 2000
const MAX_CSS_VARS = 64
const MAX_CSS_VALUE_LENGTH = 200
const MAX_ERROR_LENGTH = 500

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isBoundedString = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length <= max

const isId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH

export const isPinState = (value: unknown): value is PinState =>
  typeof value === 'string' && (PIN_STATES as readonly string[]).includes(value)

export const isLocale3d = (value: unknown): value is Locale3d => value === 'es' || value === 'en'

const isNullableText = (value: unknown, max: number): value is string | null =>
  value === null || isBoundedString(value, max)

export const isPoint3D = (value: unknown): value is Point3D =>
  isRecord(value) &&
  isId(value.id) &&
  typeof value.zoneId === 'number' &&
  Number.isInteger(value.zoneId) &&
  value.zoneId >= 0 &&
  value.zoneId < MAX_POINTS &&
  isNullableText(value.title, MAX_TITLE_LENGTH) &&
  isNullableText(value.description, MAX_DESCRIPTION_LENGTH) &&
  isPinState(value.state)

// Only our own namespaced custom properties, and nothing that can load a
// resource: the page is isolated from the network by design.
const CSS_VAR_NAME = /^--r3d-[a-z0-9-]{1,48}$/
const FORBIDDEN_CSS_VALUE = /url\s*\(|@import|expression\s*\(|[{};<>\\]/i

export const isCssVars = (value: unknown): value is CssVars => {
  if (!isRecord(value)) return false
  const entries = Object.entries(value)
  if (entries.length > MAX_CSS_VARS) return false
  return entries.every(
    ([name, cssValue]) =>
      CSS_VAR_NAME.test(name) &&
      isBoundedString(cssValue, MAX_CSS_VALUE_LENGTH) &&
      !FORBIDDEN_CSS_VALUE.test(cssValue)
  )
}

const isStatesMap = (value: unknown): value is Record<string, PinState> =>
  isRecord(value) &&
  Object.keys(value).length <= MAX_POINTS &&
  Object.entries(value).every(([id, state]) => isId(id) && isPinState(state))

export const isHostMessage = (data: unknown): data is HostMessage => {
  if (!isRecord(data) || data.v !== PROTOCOL_VERSION) return false
  switch (data.type) {
    case 'rumbos:init':
      return (
        isId(data.scene) &&
        isLocale3d(data.locale) &&
        typeof data.reducedMotion === 'boolean' &&
        isRecord(data.theme) &&
        isCssVars(data.theme.cssVars) &&
        Array.isArray(data.points) &&
        data.points.length <= MAX_POINTS &&
        data.points.every(isPoint3D)
      )
    case 'rumbos:states':
      return isStatesMap(data.states)
    case 'rumbos:locale':
      return isLocale3d(data.locale)
    case 'rumbos:theme':
      return isCssVars(data.cssVars)
    case 'rumbos:focus':
      return isId(data.pointId)
    default:
      return false
  }
}

export const isPageMessage = (data: unknown): data is PageMessage => {
  if (!isRecord(data) || data.v !== PROTOCOL_VERSION) return false
  switch (data.type) {
    case 'rumbos:ready':
      return true
    case 'rumbos:pin-click':
    case 'rumbos:open-activity':
      return isId(data.pointId)
    case 'rumbos:error':
      return isBoundedString(data.code, 64) && isBoundedString(data.message, MAX_ERROR_LENGTH)
    default:
      return false
  }
}
