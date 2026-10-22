import { useEffect, type RefObject } from 'react'
import type { MapInitialView } from '../course-map/data/types.ts'
import { viewerStorage } from '../quests/viewerStorage.ts'
import { rememberLevel, rememberView } from './resume.ts'

const SAVE_EVERY_MS = 2000

interface Options {
  enabled: boolean
  courseId: number | null
  mapId: string | null
  // The camera, as MapCanvas reports it, tagged with the level it belongs to
  // so a view from the previous level is never filed under the next one.
  viewRef: RefObject<{ mapId: string; view: MapInitialView } | null>
}

// Keeps "the last level" and "the camera on this level" up to date while the
// student looks around: every couple of seconds, when the tab is hidden or
// closed, and when the level changes.
export const useResume = ({ enabled, courseId, mapId, viewRef }: Options) => {
  useEffect(() => {
    if (!enabled || courseId === null || mapId === null) return
    rememberLevel(viewerStorage(), courseId, mapId)

    const save = () => {
      const latest = viewRef.current
      if (latest && latest.mapId === mapId)
        rememberView(viewerStorage(), courseId, mapId, latest.view)
    }
    const onHidden = () => {
      if (document.visibilityState === 'hidden') save()
    }
    const timer = window.setInterval(save, SAVE_EVERY_MS)
    window.addEventListener('pagehide', save)
    document.addEventListener('visibilitychange', onHidden)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('pagehide', save)
      document.removeEventListener('visibilitychange', onHidden)
      save()
    }
  }, [enabled, courseId, mapId, viewRef])
}
