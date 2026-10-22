// The music fades in and out (about 400 ms) so it never starts or stops with a
// click. One step of a linear fade, pure so it can be tested.

export const FADE_MS = 400

// Moves `current` toward `target` by what `dtMs` allows when a full 0..1 sweep
// takes `durationMs`.
export const fadeStep = (
  current: number,
  target: number,
  dtMs: number,
  durationMs: number = FADE_MS
): number => {
  const delta = Math.max(0, dtMs) / durationMs
  if (current < target) return Math.min(target, current + delta)
  return Math.max(target, current - delta)
}
