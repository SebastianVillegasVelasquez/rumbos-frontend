export type FullscreenEntry = 'host' | 'browser' | null

// Who can put the app in fullscreen right now, if anyone. Embedded, only the
// host can: the app asks and waits for host-fullscreen, and while it is on the
// host's exit control owns the top-right corner, so there is nothing to offer.
// Standalone, the browser's Fullscreen API does it when it exists, and the
// browser owns the way out.
export const fullscreenEntry = (state: {
  embedded: boolean
  hostFullscreen: boolean
  browserFullscreen: boolean
  browserApi: boolean
}): FullscreenEntry => {
  if (state.embedded) return state.hostFullscreen ? null : 'host'
  return state.browserApi && !state.browserFullscreen ? 'browser' : null
}
