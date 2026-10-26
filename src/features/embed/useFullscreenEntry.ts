import { useSyncExternalStore } from 'react'
import type { EmbedContextValue } from './EmbedContext.ts'
import { fullscreenEntry } from './fullscreenEntry.ts'
import { useHostFullscreen } from './hostFullscreen.ts'

const subscribeBrowser = (listener: () => void) => {
  document.addEventListener('fullscreenchange', listener)
  return () => document.removeEventListener('fullscreenchange', listener)
}
const browserFullscreen = () => document.fullscreenElement !== null
const browserApi = () => typeof document !== 'undefined' && document.fullscreenEnabled === true

// The function that enters fullscreen, or null while there is nothing to offer
// (already fullscreen, or no way to do it). Follows both host-fullscreen and the
// browser's own fullscreenchange, including exits through Escape.
export const useFullscreenEntry = (embed: EmbedContextValue | null): (() => void) | null => {
  const hostFullscreen = useHostFullscreen()
  const inBrowserFullscreen = useSyncExternalStore(subscribeBrowser, browserFullscreen, () => false)
  const entry = fullscreenEntry({
    embedded: embed !== null,
    hostFullscreen,
    browserFullscreen: inBrowserFullscreen,
    browserApi: browserApi(),
  })
  if (entry === 'host' && embed) return () => embed.requestFullscreen(true)
  if (entry === 'browser')
    return () => void document.documentElement.requestFullscreen().catch(() => {})
  return null
}
