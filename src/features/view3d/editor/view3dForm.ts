import type { LocalizedText3d, View3d } from '../../course-map/data/types.ts'
import { DESCRIPTION3D_MAX_LENGTH, TITLE3D_MAX_LENGTH } from '../../course-map/data/view3dLimits.ts'

// The editor's working copy of a map's 3D view. Texts are plain strings so
// the inputs stay controlled; empty means "use the scene's built-in text".

export interface TextForm {
  es: string
  en: string
}

export interface RowForm {
  bubbleId: string | null
  title: TextForm
  description: TextForm
}

export interface View3dForm {
  enabled: boolean
  scene: string
  // Keyed by zone id.
  rows: Record<number, RowForm>
}

export const emptyRow = (): RowForm => ({
  bubbleId: null,
  title: { es: '', en: '' },
  description: { es: '', en: '' },
})

const toLocalized = (text: TextForm, max: number): LocalizedText3d | null => {
  const es = text.es.trim().slice(0, max)
  const en = text.en.trim().slice(0, max)
  if (!es && !en) return null
  return { ...(es ? { es } : {}), ...(en ? { en } : {}) }
}

const fromLocalized = (text: LocalizedText3d | null): TextForm => ({
  es: text?.es ?? '',
  en: text?.en ?? '',
})

export const formFromView3d = (view3d: View3d | null, defaultScene: string): View3dForm => {
  const rows: Record<number, RowForm> = {}
  for (const binding of view3d?.bindings ?? []) {
    rows[binding.zoneId] = {
      bubbleId: binding.bubbleId,
      title: fromLocalized(binding.title),
      description: fromLocalized(binding.description),
    }
  }
  return { enabled: view3d !== null, scene: view3d?.scene ?? defaultScene, rows }
}

// What PUT /view3d receives: null when disabled, bindings only for zones that
// have an activity, in zone order, with blank texts omitted.
export const toView3d = (form: View3dForm): View3d | null => {
  if (!form.enabled) return null
  const bindings = Object.entries(form.rows)
    .filter(([, row]) => row.bubbleId !== null)
    .map(([zone, row]) => ({
      zoneId: Number(zone),
      bubbleId: row.bubbleId!,
      title: toLocalized(row.title, TITLE3D_MAX_LENGTH),
      description: toLocalized(row.description, DESCRIPTION3D_MAX_LENGTH),
    }))
    .sort((a, b) => a.zoneId - b.zoneId)
  return { scene: form.scene, bindings }
}

// Server data in the same canonical shape toView3d produces, so the two can
// be compared without false differences (order, blank texts).
export const canonicalView3d = (view3d: View3d | null): View3d | null =>
  view3d && {
    scene: view3d.scene,
    bindings: [...view3d.bindings]
      .sort((a, b) => a.zoneId - b.zoneId)
      .map((binding) => ({
        zoneId: binding.zoneId,
        bubbleId: binding.bubbleId,
        title: toLocalized(fromLocalized(binding.title), TITLE3D_MAX_LENGTH),
        description: toLocalized(fromLocalized(binding.description), DESCRIPTION3D_MAX_LENGTH),
      })),
  }

export const isDirty = (form: View3dForm, saved: View3d | null): boolean =>
  JSON.stringify(toView3d(form)) !== JSON.stringify(canonicalView3d(saved))

export const boundCount = (form: View3dForm): number =>
  Object.values(form.rows).filter((row) => row.bubbleId !== null).length

// Bubbles in guided-sequence order fill zones 0..n-1. A bubble that was
// already bound keeps its custom texts even if its zone changes.
export const autoAssign = (
  form: View3dForm,
  bubbleIdsBySequence: readonly string[],
  zoneCount: number
): View3dForm => {
  const previous = new Map(
    Object.values(form.rows).flatMap((row) => (row.bubbleId ? [[row.bubbleId, row] as const] : []))
  )
  const rows: Record<number, RowForm> = {}
  bubbleIdsBySequence.slice(0, zoneCount).forEach((bubbleId, zone) => {
    rows[zone] = previous.get(bubbleId) ?? { ...emptyRow(), bubbleId }
  })
  return { ...form, rows }
}

export const clearBindings = (form: View3dForm): View3dForm => ({ ...form, rows: {} })

// Choosing a bubble that is already bound elsewhere is prevented in the UI;
// this also moves it if a caller insists.
export const setZoneBubble = (
  form: View3dForm,
  zone: number,
  bubbleId: string | null
): View3dForm => {
  const rows = { ...form.rows }
  if (bubbleId !== null) {
    for (const [other, row] of Object.entries(rows)) {
      if (Number(other) !== zone && row.bubbleId === bubbleId) delete rows[Number(other)]
    }
  }
  if (bubbleId === null) delete rows[zone]
  else rows[zone] = { ...(rows[zone] ?? emptyRow()), bubbleId }
  return { ...form, rows }
}

export const setZoneText = (
  form: View3dForm,
  zone: number,
  field: 'title' | 'description',
  language: 'es' | 'en',
  value: string
): View3dForm => {
  const row = form.rows[zone]
  if (!row) return form
  return {
    ...form,
    rows: { ...form.rows, [zone]: { ...row, [field]: { ...row[field], [language]: value } } },
  }
}

// How many activities cannot appear because the scene has fewer zones.
export const overflowCount = (bubbleCount: number, zoneCount: number) =>
  Math.max(0, bubbleCount - zoneCount)

// Backend 422 codes of PUT /view3d.
export const VIEW3D_ERROR_CODES = [
  'scene_unknown',
  'zone_out_of_range',
  'duplicate_zone',
  'duplicate_bubble',
  'bubble_not_in_map',
] as const
export type View3dErrorCode = (typeof VIEW3D_ERROR_CODES)[number]

export const asView3dErrorCode = (code: unknown): View3dErrorCode | null =>
  (VIEW3D_ERROR_CODES as readonly unknown[]).includes(code) ? (code as View3dErrorCode) : null
