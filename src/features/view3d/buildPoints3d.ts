import type { RenderableMap } from '../course-map/renderable.ts'
import type { LocalizedText3d, ResolvedCourseMap, View3d } from '../course-map/data/types.ts'
import {
  deriveVisualState,
  nextIncompleteSequence,
  type MapView,
  type VisualState,
} from '../course-map/visualState.ts'
import { isContentBubble } from '../content/contentTypes.ts'
import { countsTowardProgress } from '../course-map/progress.ts'
import type { Locale3d, PinState, Point3D } from './protocol.ts'

// The pin a student sees for each 2D visual state. A bubble in progress is
// simply open, and an unverifiable one (Moodle outage) is not blocked either.
export const pinStateFor = (state: VisualState): PinState =>
  state === 'inProgress' || state === 'unknown' || state === 'untracked' ? 'available' : state

const pickText = (text: LocalizedText3d | null, locale: Locale3d): string | null => {
  const value = text?.[locale]?.trim()
  return value ? value : null
}

// Joins the map's bubbles, the 3D bindings and the resolved Moodle data into
// the points the 3D page draws. Works on a RenderableMap, so the same code
// serves students (published snapshot) and the editor preview (draft).
//   title:       the binding's override, else the activity's name, else null
//   description: the binding's override, else null (the scene's text is used)
//   state:       the same deriveVisualState the 2D view uses
export const buildPoints3d = (
  map: RenderableMap,
  view3d: View3d,
  resolved: ResolvedCourseMap | null | undefined,
  locale: Locale3d,
  view: MapView = 'student'
): Point3D[] => {
  const bubbleById = new Map(map.bubbles.map((bubble) => [bubble.id, bubble]))
  const resolvedById = new Map((resolved?.bubbles ?? []).map((item) => [item.bubbleId, item]))
  const nextSequence = nextIncompleteSequence(map.bubbles, (bubble) =>
    countsTowardProgress(bubble, resolvedById.get(bubble.id)?.availability, view)
  )

  const points: Point3D[] = []
  for (const binding of [...view3d.bindings].sort((a, b) => a.zoneId - b.zoneId)) {
    const bubble = bubbleById.get(binding.bubbleId)
    if (!bubble) continue
    const item = resolvedById.get(bubble.id)
    const visual = deriveVisualState({
      status: bubble.status,
      sequence: bubble.sequence,
      mode: map.settings.mode,
      availability: item?.availability,
      view,
      tracked: bubble.tracked,
      informational: isContentBubble(bubble),
      nextIncompleteSequence: nextSequence,
    })
    points.push({
      id: bubble.id,
      zoneId: binding.zoneId,
      title:
        pickText(binding.title, locale) ??
        (item?.activity?.name.trim() || bubble.content?.title.trim() || null),
      description: pickText(binding.description, locale),
      state: pinStateFor(visual),
    })
  }
  return points
}
