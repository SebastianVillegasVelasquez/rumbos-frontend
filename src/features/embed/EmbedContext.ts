import { createContext, useContext } from 'react'
import type { AuthRole } from '../course-map/data/types.ts'

// Present only under the /embed route; null means the standalone app.
export interface EmbedContextValue {
  role: AuthRole
  courseId: number
  // Tell the host to open an activity. Only the cmid travels: the host looks
  // the URL up in its own state, the app never builds or sends one.
  openActivity: (cmid: number) => void
  // Ask the host for a fresh CourseState (throttled).
  requestState: () => void
  requestFullscreen: (on: boolean) => void
}

export const EmbedContext = createContext<EmbedContextValue | null>(null)

export const useEmbed = () => useContext(EmbedContext)
