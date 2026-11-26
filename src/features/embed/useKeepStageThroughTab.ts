import { useEffect } from 'react'
import type { EmbedContextValue } from './EmbedContext.ts'
import { getHostFullscreen, subscribeHostFullscreen } from './hostFullscreen.ts'
import { createTabFullscreenGuard } from './tabFullscreenGuard.ts'

// A PDF opened in another tab must not take the editor's fullscreen with it: when they come
// back to this tab and the stage fell meanwhile, ask the host for it again (see
// tabFullscreenGuard.ts). The viewer's own exit is never undone.
export const useKeepStageThroughTab = (embed: EmbedContextValue | null) => {
  const requestFullscreen = embed?.requestFullscreen
  useEffect(() => {
    if (!requestFullscreen) return
    const guard = createTabFullscreenGuard(getHostFullscreen())
    const unsubscribe = subscribeHostFullscreen(() => void guard.hostChanged(getHostFullscreen()))
    const onVisibility = () => {
      if (guard.visibilityChanged(document.visibilityState === 'visible') === 'restore')
        requestFullscreen(true)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [requestFullscreen])
}
