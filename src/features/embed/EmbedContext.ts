import { createContext, useContext } from 'react'
import type { AuthRole } from '../course-map/data/types.ts'
import type { HostMode } from './protocol.ts'

// Present only under the /embed route; null means the standalone app.
export interface EmbedContextValue {
  role: AuthRole
  // The mode of the UI, decided by the host: "editor" only for a user whose role
  // is editor while Moodle's editing mode is on (host-init.mode). Otherwise the
  // app renders what students see, even for an editor.
  mode: HostMode
  courseId: number
  // Tell the host to open an activity. Only the cmid travels: the host looks
  // the URL up in its own state, the app never builds or sends one.
  openActivity: (cmid: number) => void
  // Contract v5.4, editor mode: ask the host to open the activity's settings
  // page in a new tab (cmid only). Hosts that predate v5.4 ignore it, so the UI
  // offers it only when useHostSupportsActivitySettings is true.
  openActivitySettings: (cmid: number) => void
  // Ask the host for a fresh CourseState (throttled).
  requestState: () => void
  requestFullscreen: (on: boolean) => void
}

export const EmbedContext = createContext<EmbedContextValue | null>(null)

export const useEmbed = () => useContext(EmbedContext)
