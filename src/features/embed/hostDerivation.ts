import type {
  Activity,
  Availability,
  BubbleStatus,
  RenderableBubble,
  ResolvedBubble,
} from '../course-map/data/types.ts'
import type { CourseState, HostActivity, HostSection } from './protocol.ts'

// The shared status-derivation rule (contract v5), applied to the host's
// CourseState. A bubble's `activityId` is the activity's cmid.
//
//   cmid in unavailableCmids      -> availability "hidden" with no activity:
//                                    students get the teaser ("Próximamente")
//   cmid in neither list          -> "missing" (editors: "Quitar del mapa")
//   availability "hidden"         -> "hidden" (editors: "Oculta para estudiantes")
//   availability "restricted"     -> "restricted": locked, tooltip from availabilityInfo
//   completion complete           -> status complete
//   completion incomplete         -> status no_complete
//   completion failed             -> status in_progress
//   completion none               -> status no_complete, but untracked: it can
//                                    never complete, so it is not "next", does
//                                    not block the guided sequence and is left
//                                    out of the progress counts

export interface HostIndex {
  activities: Map<number, HostActivity>
  unavailable: Set<number>
  sections: Map<number, HostSection>
}

export const indexCourseState = (state: CourseState): HostIndex => ({
  activities: new Map(state.activities.map((activity) => [activity.cmid, activity])),
  unavailable: new Set(state.unavailableCmids),
  sections: new Map(state.sections.map((section) => [section.id, section])),
})

export const availabilityFor = (index: HostIndex, cmid: number): Availability => {
  if (index.unavailable.has(cmid)) return 'hidden'
  const host = index.activities.get(cmid)
  if (!host) return 'missing'
  return host.availability
}

export const statusFor = (host: HostActivity | undefined): BubbleStatus => {
  switch (host?.completion) {
    case 'complete':
      return 'complete'
    case 'failed':
      return 'in_progress'
    default:
      return 'no_complete'
  }
}

// Moodle tracks the activity's completion. An activity the host does not list
// (hidden from this user, or gone) is not judged: availability handles it.
export const isTrackedFor = (host: HostActivity | undefined): boolean =>
  host === undefined || host.completion !== 'none'

// Same objects back when nothing changed, so an unrelated refresh does not
// look like new data to the canvas.
export const applyHostStatus = (
  index: HostIndex,
  bubbles: RenderableBubble[]
): RenderableBubble[] =>
  bubbles.map((bubble) => {
    const host = index.activities.get(bubble.activityId)
    const status = statusFor(host)
    const tracked = isTrackedFor(host)
    if (status === bubble.status && (bubble.tracked !== false) === tracked) return bubble
    const { tracked: _previous, ...rest } = bubble
    void _previous
    return tracked ? { ...rest, status } : { ...rest, status, tracked: false }
  })

export interface Placement {
  placed: boolean
  bubbleId: string | null
  placedInMapId: string | null
}

export const NOT_PLACED: Placement = { placed: false, bubbleId: null, placedInMapId: null }

// The app's Activity for a host activity. `url` stays empty on purpose: URLs
// never cross the boundary, the host opens the activity from its cmid.
export const toActivity = (
  index: HostIndex,
  host: HostActivity,
  placement: Placement
): Activity => {
  const section = index.sections.get(host.sectionId)
  return {
    activityId: host.cmid,
    name: host.name,
    modname: host.modname,
    url: '',
    sectionId: host.sectionId,
    sectionName: section?.name ?? '',
    sectionNumber: section?.number ?? 0,
    hidden: host.availability === 'hidden',
    availabilityInfo: host.availabilityInfo,
    ...placement,
  }
}

// The /resolved shape for one map's bubbles. `showHidden` is the editor's
// view: students (and the editor's preview) get no activity behind a hidden
// one, exactly like the backend does.
export const resolveHostBubbles = (
  index: HostIndex,
  bubbles: RenderableBubble[],
  mapId: string,
  showHidden: boolean
): ResolvedBubble[] =>
  bubbles.map((bubble) => {
    const availability = availabilityFor(index, bubble.activityId)
    const host = index.activities.get(bubble.activityId)
    const visible = host && (availability !== 'hidden' || showHidden) && availability !== 'missing'
    return {
      bubbleId: bubble.id,
      availability,
      activity:
        visible && !index.unavailable.has(bubble.activityId)
          ? toActivity(index, host, { placed: true, bubbleId: bubble.id, placedInMapId: mapId })
          : null,
    }
  })
