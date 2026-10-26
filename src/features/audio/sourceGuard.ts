// A failing audio source gets one more try and then is given up on for the
// session: no retry storm, and nothing is reported to the host (the music is a
// local, secondary feature).
export interface SourceGuard {
  // A new source: the retry is available again.
  reset: () => void
  dispose: () => void
}

export const guardSource = (
  target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>,
  handlers: { retry: () => void; fail: () => void }
): SourceGuard => {
  let retried = false
  const onError = () => {
    if (retried) {
      handlers.fail()
      return
    }
    retried = true
    handlers.retry()
  }
  target.addEventListener('error', onError)
  return {
    reset: () => {
      retried = false
    },
    dispose: () => target.removeEventListener('error', onError),
  }
}
