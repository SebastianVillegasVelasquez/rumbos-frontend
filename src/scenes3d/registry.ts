import regionEncuentros from '../../3d/scenes/region-encuentros.json'

// The scenes the frontend can draw. The zone JSON under 3d/scenes/ is the
// single source of truth, imported here (editor placeholders) and by the 3D
// page itself. A scene is hand-authored: it has exactly `zoneCount` zones and
// cannot adapt to an arbitrary number of activities.

export interface LocalizedText {
  es: string
  en: string
}

export interface ZoneDefinition {
  id: number
  tag: LocalizedText
  subtitle: LocalizedText
  title: LocalizedText
  place: LocalizedText
  description: LocalizedText
  image: string | null
}

export interface SceneDefinition {
  id: string
  label: string
  zoneCount: number
  title: LocalizedText
  zones: readonly ZoneDefinition[]
}

const fromJson = (scene: typeof regionEncuentros): SceneDefinition => ({
  id: scene.id,
  label: scene.title.es,
  zoneCount: scene.zoneCount,
  title: scene.title,
  zones: scene.zones,
})

export const SCENES_3D: readonly SceneDefinition[] = [fromJson(regionEncuentros)]

export const getScene3d = (sceneId: string): SceneDefinition | undefined =>
  SCENES_3D.find((scene) => scene.id === sceneId)
