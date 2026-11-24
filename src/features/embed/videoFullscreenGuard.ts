// The host's stage (host-fullscreen) is the browser's native fullscreen on the host's
// wrapper. A video player inside the app goes fullscreen on its own, and leaving it (its
// button or Escape) can take the whole stack down: the host sees the native fullscreen end,
// takes it for the viewer leaving, and collapses the stage, so the viewer has to open it
// again. This tells that case apart: the host turned the stage off while a video's
// fullscreen was on, or just ended, and the stage was on before the video began.
//
// Pure: the hook feeds it the two signals (the host's state, this document's fullscreen
// element) with a clock, and asks the host for the stage back when it answers 'restore'.

// The two events come from different frames, so they can arrive in either order.
export const VIDEO_FULLSCREEN_WINDOW_MS = 1500

export type GuardAnswer = 'restore' | null

export interface VideoFullscreenGuard {
  hostChanged: (on: boolean) => GuardAnswer
  videoFullscreenChanged: (active: boolean) => GuardAnswer
}

export const createVideoFullscreenGuard = (
  initialHostOn: boolean,
  now: () => number
): VideoFullscreenGuard => {
  let hostOn = initialHostOn
  let videoActive = false
  // Whether the stage was on when the video's fullscreen began.
  let stageBeforeVideo = false
  let videoEndedAt: number | null = null
  let collapsedWhileActive = false

  const settle = (): GuardAnswer => {
    stageBeforeVideo = false
    videoEndedAt = null
    collapsedWhileActive = false
    return 'restore'
  }

  return {
    hostChanged(on) {
      const was = hostOn
      hostOn = on
      if (on) {
        // Back on (by our request or the viewer's own): nothing left to restore.
        collapsedWhileActive = false
        if (!videoActive) stageBeforeVideo = false
        return null
      }
      if (!was || !stageBeforeVideo) return null
      if (videoActive) {
        collapsedWhileActive = true
        return null
      }
      if (videoEndedAt !== null && now() - videoEndedAt <= VIDEO_FULLSCREEN_WINDOW_MS)
        return settle()
      return null
    },
    videoFullscreenChanged(active) {
      if (active === videoActive) return null
      videoActive = active
      if (active) {
        stageBeforeVideo = hostOn
        videoEndedAt = null
        collapsedWhileActive = false
        return null
      }
      videoEndedAt = now()
      if (stageBeforeVideo && collapsedWhileActive && !hostOn) return settle()
      return null
    },
  }
}
