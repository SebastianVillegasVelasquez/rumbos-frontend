export const READY_INTERVAL_MS = 500
export const READY_WINDOW_MS = 10_000

// The host's JavaScript may attach its listener after the iframe has loaded, so
// a single `embed-ready` can be lost. Send it now and then every interval until
// stopped (the first valid host-init) or until the window runs out. The host
// treats duplicates idempotently. Returns the stop function.
export const startReadyRetry = (
  send: () => void,
  intervalMs = READY_INTERVAL_MS,
  windowMs = READY_WINDOW_MS
): (() => void) => {
  send()
  // Declared first so that, on the tick the window ends, it wins over the send.
  const limit = setTimeout(() => clearInterval(timer), windowMs)
  const timer = setInterval(send, intervalMs)
  return () => {
    clearInterval(timer)
    clearTimeout(limit)
  }
}
