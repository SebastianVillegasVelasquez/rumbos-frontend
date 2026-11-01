import { useSyncExternalStore } from 'react'

// Which control the guided tour is pointing at right now. The tour publishes it;
// the music disc reads it so its "now playing" pill does not talk over the step
// that explains the same control. Dependency free on purpose.
export type CoachTarget = 'audio' | null

let current: CoachTarget = null
const listeners = new Set<() => void>()

export const setCoachTarget = (next: CoachTarget) => {
  if (next === current) return
  current = next
  listeners.forEach((listener) => listener())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

export const useCoachTarget = (): CoachTarget => useSyncExternalStore(subscribe, () => current)
