import { createContext } from 'react'
import type { Activity, RenderableBubble, ResolvedCourseMap } from '../data/types.ts'

// Everything the app knows about the Moodle side of a level: which activities
// exist, which the current user may open, and how far along they are. The
// canvas, the effects engine, the overview list, the 3D adapter and the editor
// sidebar consume only this shape; where it comes from (the backend's /resolved
// and /activities, or the Moodle plugin through the embed host) is hidden
// behind a MoodleStateProvider.

export interface MoodleStateParams {
  // Exactly one of these is set while a map is open: the draft id for the
  // editor's Edición/Vista previa, the published id for the student view.
  draftId: string | null
  publishedId: string | null
  showPublished: boolean
  // Editors see hidden activities; students do not.
  isEditor: boolean
  moodleCourseId: number | null
  // The open map's own bubbles, as stored (status as the map holds it).
  bubbles: RenderableBubble[]
}

export interface MoodleState {
  // The same bubbles, with each status as this source reports it for the
  // current user (the backend source keeps the stored demo status).
  bubbles: RenderableBubble[]
  // Everything the user may see in the course, for the sidebar, the overview
  // list and per-bubble lookups. `placed` flags are filled in.
  activities: Activity[]
  activitiesPending: boolean
  activitiesError: boolean
  refetchActivities: () => void
  // Per-bubble availability and activity, in the shape of GET .../resolved.
  resolved: ResolvedCourseMap | undefined
  resolvedPending: boolean
  resolvedError: boolean
  refetchResolved: () => void
}

export type MoodleStateProvider = (params: MoodleStateParams) => MoodleState

// Set by the embed route to the host-based provider; the default is installed
// in moodleStateContext.ts to keep this file free of data-layer imports.
export const MoodleStateContext = createContext<MoodleStateProvider | null>(null)
