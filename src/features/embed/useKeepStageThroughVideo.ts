import { useEffect } from 'react'
import type { EmbedContextValue } from './EmbedContext.ts'
import { getHostFullscreen, subscribeHostFullscreen } from './hostFullscreen.ts'
import { createVideoFullscreenGuard } from './videoFullscreenGuard.ts'

// A video that leaves its own fullscreen must not take the host's stage with it (see
// videoFullscreenGuard.ts): when the host collapses the stage because of it, ask for the
// stage back. The viewer's own exit from the stage is never undone.
export const useKeepStageThroughVideo = (embed: EmbedContextValue | null) => {
  const requestFullscreen = embed?.requestFullscreen
  useEffect(() => {
    if (!requestFullscreen) return
    const guard = createVideoFullscreenGuard(getHostFullscreen(), () => Date.now())
    const answer = (result: 'restore' | null) => {
      if (result === 'restore') requestFullscreen(true)
    }
    const onDocument = () =>
      answer(guard.videoFullscreenChanged(document.fullscreenElement !== null))
    const unsubscribe = subscribeHostFullscreen(() =>
      answer(guard.hostChanged(getHostFullscreen()))
    )
    document.addEventListener('fullscreenchange', onDocument)
    return () => {
      unsubscribe()
      document.removeEventListener('fullscreenchange', onDocument)
    }
  }, [requestFullscreen])
}
