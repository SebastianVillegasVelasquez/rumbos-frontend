// Throttled, coalescing requests for a fresh CourseState.
//
// A request inside the minimum gap is not dropped: it is deferred to the end of
// the gap (trailing edge), and any number of them share that one send. So a
// burst of triggers (focus, visibility, an overlay closing) costs one message,
// and the last trigger is never lost.

export interface StateRequesterDeps {
  send: () => void
  now: () => number
  schedule: (run: () => void, delayMs: number) => () => void
  // How many host states have arrived so far (changed or not).
  receivedCount: () => number
}

export const MIN_REFRESH_GAP_MS = 3_000
// The host refreshes by itself when it closes an overlay; the app only steps in
// if nothing has arrived after this long.
export const OVERLAY_GRACE_MS = 1_500

export interface StateRequester {
  request: () => void
  // The host's overlay closed: expect its refresh, ask once ourselves if it
  // does not come.
  afterOverlayClosed: () => void
  dispose: () => void
}

export const createStateRequester = (
  deps: StateRequesterDeps,
  minGapMs = MIN_REFRESH_GAP_MS,
  graceMs = OVERLAY_GRACE_MS
): StateRequester => {
  let lastSentAt = -Infinity
  let cancelTrailing: (() => void) | null = null
  let cancelGrace: (() => void) | null = null

  const sendNow = () => {
    cancelTrailing = null
    lastSentAt = deps.now()
    deps.send()
  }

  const request = () => {
    if (cancelTrailing) return
    const wait = lastSentAt + minGapMs - deps.now()
    if (wait <= 0) sendNow()
    else cancelTrailing = deps.schedule(sendNow, wait)
  }

  return {
    request,
    afterOverlayClosed: () => {
      cancelGrace?.()
      const before = deps.receivedCount()
      cancelGrace = deps.schedule(() => {
        cancelGrace = null
        if (deps.receivedCount() === before) request()
      }, graceMs)
    },
    dispose: () => {
      cancelTrailing?.()
      cancelGrace?.()
      cancelTrailing = null
      cancelGrace = null
    },
  }
}
