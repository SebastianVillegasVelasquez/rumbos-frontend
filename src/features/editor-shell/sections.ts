// The editor's rail picks what the content area shows. "map" is the map editor
// itself; every other section replaces it in full view.
export type SectionId = 'map' | 'activities' | 'levels' | 'heat' | 'appearance' | 'summary'

export const SECTION_IDS: readonly SectionId[] = [
  'map',
  'activities',
  'levels',
  'heat',
  'appearance',
  'summary',
]

export const isSectionId = (value: unknown): value is SectionId =>
  typeof value === 'string' && (SECTION_IDS as readonly string[]).includes(value)

const SECTION_KEY = 'rumbos.editor.section'
const FULLSCREEN_KEY = 'rumbos.editor.fullscreen'

type Store = Pick<Storage, 'getItem' | 'setItem'> | null

// The last section the editor had open. Anything unknown (an old build, a
// hand-edited value) or unavailable falls back to the map.
export const readSection = (store: Store, available: readonly SectionId[]): SectionId => {
  try {
    const value = store?.getItem(SECTION_KEY)
    return isSectionId(value) && available.includes(value) ? value : 'map'
  } catch {
    return 'map'
  }
}

export const rememberSection = (section: SectionId, store: Store) => {
  try {
    store?.setItem(SECTION_KEY, section)
  } catch {
    // Private mode or a full quota: remembering is a convenience only.
  }
}

// Whether the editor asks for the host's fullscreen when it opens. On unless
// the editor turned it off ("0").
export const readFullscreenOnOpen = (store: Store): boolean => {
  try {
    return store?.getItem(FULLSCREEN_KEY) !== '0'
  } catch {
    return true
  }
}

export const rememberFullscreenOnOpen = (on: boolean, store: Store) => {
  try {
    store?.setItem(FULLSCREEN_KEY, on ? '1' : '0')
  } catch {
    // See rememberSection.
  }
}

// Scroll positions per section, so closing a preview, a PDF tab or a dialog
// (or switching sections and coming back) leaves the editor where it was.
export interface ScrollMemory {
  save: (key: string, top: number) => void
  read: (key: string) => number
}

export const createScrollMemory = (): ScrollMemory => {
  const tops = new Map<string, number>()
  return {
    save: (key, top) => void tops.set(key, Math.max(0, Math.round(top))),
    read: (key) => tops.get(key) ?? 0,
  }
}

// The sections this editor can open: the heat map needs a host that can answer, Niveles a course.
export const sectionsFor = (can: { heat: boolean; levels: boolean }): SectionId[] =>
  SECTION_IDS.filter((id) => (id !== 'heat' || can.heat) && (id !== 'levels' || can.levels))

// A remembered or requested section that is not on offer here is the map.
export const resolveSection = (wanted: SectionId, available: readonly SectionId[]): SectionId =>
  available.includes(wanted) ? wanted : 'map'

// Sections that leave the map on screen (so activities can still be dragged onto it).
export const keepsMapVisible = (section: SectionId): boolean => section === 'activities'

// Where the n-th activity placed from the list goes: spread over the level in relative
// coordinates, always inside it, so several placed in a row do not pile up.
export const spreadPlacement = (n: number): { x: number; y: number } => ({
  x: 0.15 + ((n * 0.13) % 0.7),
  y: 0.2 + ((n * 0.21) % 0.6),
})
