// The exam's time comes from the server. The device clock is only used to
// interpolate between two server answers: the offset (server minus device) is
// computed from every response that carries `server_now`, so a device with a
// wrong clock, or one that is changed mid-exam, does not change the deadline.
// The browser countdown is cosmetic; the server closes the attempt itself.

export interface ServerClock {
  // server time minus device time, in ms.
  offsetMs: number
  deadlineMs: number
}

export const parseInstant = (iso: string): number => {
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : NaN
}

// `deviceNowMs` is when the response arrived on the device. Half a round trip is
// ignored on purpose: it only ever makes the countdown a little longer than the
// truth by the latency, and the server decides at zero anyway.
export const syncClock = (
  input: { server_now: string; deadline_at: string },
  deviceNowMs: number
): ServerClock | null => {
  const serverNow = parseInstant(input.server_now)
  const deadline = parseInstant(input.deadline_at)
  if (Number.isNaN(serverNow) || Number.isNaN(deadline)) return null
  return { offsetMs: serverNow - deviceNowMs, deadlineMs: deadline }
}

export const remainingMs = (clock: ServerClock, deviceNowMs: number): number =>
  Math.max(0, clock.deadlineMs - (deviceNowMs + clock.offsetMs))

// Minutes left, rounded up: "1 min" until the very end, never "0 min" before zero.
export const remainingMinutes = (ms: number): number => Math.ceil(ms / 60_000)

export const ANNOUNCE_AT_MINUTES = [10, 5, 1] as const

// Which announcement is due, given the previous and the current remaining time.
// Only the thresholds are said, once each, and never every second. Returns the
// threshold crossed (the smallest one when a long gap crosses several), or null.
export const announcementDue = (previousMs: number | null, currentMs: number): number | null => {
  if (currentMs <= 0) return null
  const crossed = ANNOUNCE_AT_MINUTES.filter(
    (minutes) =>
      currentMs <= minutes * 60_000 && (previousMs === null || previousMs > minutes * 60_000)
  )
  return crossed.length > 0 ? Math.min(...crossed) : null
}

// "mm:ss" for a visible countdown, "h:mm:ss" past an hour.
export const formatClock = (ms: number): string => {
  const total = Math.ceil(Math.max(0, ms) / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const two = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`
}
