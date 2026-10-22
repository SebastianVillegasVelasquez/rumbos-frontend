// Picking up where the student left off: the last level they had open in a
// course and the camera view they had on each level. A per-viewer convenience
// kept in localStorage, which can be empty, blocked or hold anything: every
// read is validated and every access is guarded.

export interface SavedView {
  x: number
  y: number
  zoom: number
}

export interface ResumeData {
  lastMapId: string | null
  views: Record<string, SavedView>
}

type ReadStorage = Pick<Storage, 'getItem'> | null
type WriteStorage = Pick<Storage, 'getItem' | 'setItem'> | null

const MAX_VIEWS = 30
const MAX_ID_LENGTH = 64
const MIN_ZOOM = 1
const MAX_ZOOM = 3

const keyFor = (courseId: number) => `rumbos.resume.${courseId}`

const isUnit = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1

const isId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH

export const parseSavedView = (value: unknown): SavedView | null => {
  if (typeof value !== 'object' || value === null) return null
  const { x, y, zoom } = value as Record<string, unknown>
  if (!isUnit(x) || !isUnit(y)) return null
  if (typeof zoom !== 'number' || !Number.isFinite(zoom)) return null
  return { x, y, zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)) }
}

export const readResume = (storage: ReadStorage, courseId: number): ResumeData => {
  const empty: ResumeData = { lastMapId: null, views: {} }
  try {
    const raw = storage?.getItem(keyFor(courseId))
    if (!raw) return empty
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return empty
    const record = parsed as Record<string, unknown>
    const views: Record<string, SavedView> = {}
    if (typeof record.views === 'object' && record.views !== null) {
      for (const [mapId, view] of Object.entries(record.views).slice(0, MAX_VIEWS)) {
        const clean = parseSavedView(view)
        if (isId(mapId) && clean) views[mapId] = clean
      }
    }
    return { lastMapId: isId(record.lastMapId) ? record.lastMapId : null, views }
  } catch {
    return empty
  }
}

const write = (storage: WriteStorage, courseId: number, data: ResumeData) => {
  try {
    // Oldest views fall off first: keys keep insertion order.
    const entries = Object.entries(data.views).slice(-MAX_VIEWS)
    storage?.setItem(
      keyFor(courseId),
      JSON.stringify({ lastMapId: data.lastMapId, views: Object.fromEntries(entries) })
    )
  } catch {
    // Not remembered; nothing else depends on it.
  }
}

export const rememberLevel = (storage: WriteStorage, courseId: number, mapId: string) => {
  if (!isId(mapId)) return
  const data = readResume(storage, courseId)
  if (data.lastMapId === mapId) return
  write(storage, courseId, { ...data, lastMapId: mapId })
}

export const rememberView = (
  storage: WriteStorage,
  courseId: number,
  mapId: string,
  view: SavedView
) => {
  const clean = parseSavedView(view)
  if (!isId(mapId) || !clean) return
  const data = readResume(storage, courseId)
  const previous = data.views[mapId]
  if (previous && previous.x === clean.x && previous.y === clean.y && previous.zoom === clean.zoom)
    return
  const { [mapId]: _old, ...others } = data.views
  void _old
  write(storage, courseId, { ...data, views: { ...others, [mapId]: clean } })
}

export const forgetView = (storage: WriteStorage, courseId: number, mapId: string) => {
  const data = readResume(storage, courseId)
  if (!(mapId in data.views)) return
  const { [mapId]: _old, ...others } = data.views
  void _old
  write(storage, courseId, { ...data, views: others })
}
