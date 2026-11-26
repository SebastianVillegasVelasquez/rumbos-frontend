// Opening a PDF (or any link) in another tab takes the browser's native fullscreen down
// with it, and the host collapses its stage. The editor had asked for no such thing: when
// they come back the stage must be there. The viewer's own exit (the host's minimize
// control) happens while the tab is visible and is never undone.
//
// Pure: the hook feeds it the host's stage state and the tab's visibility.

export type TabGuardAnswer = 'restore' | null

export interface TabFullscreenGuard {
  hostChanged: (on: boolean) => TabGuardAnswer
  visibilityChanged: (visible: boolean) => TabGuardAnswer
}

export const createTabFullscreenGuard = (initialHostOn: boolean): TabFullscreenGuard => {
  let hostOn = initialHostOn
  let visible = true
  // The stage was on when the tab went away.
  let stageBeforeHide = false

  return {
    hostChanged(on) {
      hostOn = on
      return null
    },
    visibilityChanged(nowVisible) {
      if (nowVisible === visible) return null
      visible = nowVisible
      if (!nowVisible) {
        stageBeforeHide = hostOn
        return null
      }
      const restore = stageBeforeHide && !hostOn
      stageBeforeHide = false
      return restore ? 'restore' : null
    },
  }
}
