import { canonicalJson } from '../course-map/data/canonicalJson.ts'
import type { MapSettings, MapWelcome } from '../course-map/data/types.ts'

// The rules of the welcome curtain, free of React and the DOM so they can be
// tested: what the settings mean with their defaults, the title, the button
// labels and whether the curtain shows at all.

export const DEFAULT_WELCOME: MapWelcome = {
  enabled: true,
  title: null,
  message: null,
  video: null,
  playOnEnter: true,
  show: 'first_visit',
}

// Null, absent or partial settings all mean the defaults.
export const resolveWelcome = (welcome: MapSettings['welcome']): MapWelcome => ({
  ...DEFAULT_WELCOME,
  ...(welcome ?? {}),
})

export const PLACEHOLDER = '{curso}'

// The configured text, or the default. {curso} becomes the course's name from
// the host, else the map's title. The name is untrusted text: it is only
// substituted into a string that React renders as a text node.
export const welcomeTitle = (
  welcome: MapWelcome,
  defaultTitle: string,
  names: { courseName: string | null; mapTitle: string }
): string => {
  const template = welcome.title?.trim() ? welcome.title : defaultTitle
  const name = names.courseName?.trim() || names.mapTitle
  return template.split(PLACEHOLDER).join(name)
}

export type PrimaryAction = 'play' | 'start'

// With a video that plays on entering, the button is "Reproducir"; otherwise
// "Empezar viaje" (with a secondary "Ver video" when there is a video).
export const primaryAction = (welcome: MapWelcome): PrimaryAction =>
  welcome.video && welcome.playOnEnter ? 'play' : 'start'

export const hasOptionalVideo = (welcome: MapWelcome): boolean =>
  welcome.video !== null && !welcome.playOnEnter

// FNV-1a over the canonical settings: a changed welcome is a new welcome, so
// viewers who saw the old one see the new one once.
export const welcomeHash = (welcome: MapWelcome): string => {
  const text = canonicalJson(welcome)
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

const KEY_PREFIX = 'rumbos.welcome.seen.'

export const readWelcomeSeen = (
  storage: Pick<Storage, 'getItem'> | null,
  mapId: string,
  hash: string
): boolean => {
  try {
    return storage?.getItem(KEY_PREFIX + mapId) === hash
  } catch {
    // Unknown: do not nag, the curtain is a courtesy.
    return true
  }
}

export const rememberWelcomeSeen = (
  storage: Pick<Storage, 'setItem'> | null,
  mapId: string,
  hash: string
) => {
  try {
    storage?.setItem(KEY_PREFIX + mapId, hash)
  } catch {
    // Not remembered; "first visit" then means "each time this tab starts".
  }
}

// Maps whose curtain was already handled since the app started: "always" means
// each time the app starts, not on every 2D/3D switch or level change.
const handledThisSession = new Set<string>()

export const markWelcomeHandled = (mapId: string, hash: string) =>
  void handledThisSession.add(`${mapId}:${hash}`)

export interface ShowInput {
  welcome: MapWelcome
  mapId: string
  // Editors in editor mode never see it; "Vista previa" does.
  isEditorMode: boolean
  // The app told the host there is nothing to show.
  noContent: boolean
  storage: Pick<Storage, 'getItem'> | null
}

export const shouldShowWelcome = (input: ShowInput): boolean => {
  const { welcome, mapId, isEditorMode, noContent, storage } = input
  if (!welcome.enabled || isEditorMode || noContent) return false
  const hash = welcomeHash(welcome)
  if (handledThisSession.has(`${mapId}:${hash}`)) return false
  if (welcome.show === 'always') return true
  return !readWelcomeSeen(storage, mapId, hash)
}

// Test helper: a fresh app start.
export const resetWelcomeSession = () => handledThisSession.clear()
