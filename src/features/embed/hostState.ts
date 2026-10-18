import { useSyncExternalStore } from 'react'
import type { CourseState } from './protocol.ts'

// The latest CourseState the host sent: the current user's Moodle view of the
// course. Module state (not React state) because the session writes it from a
// message listener; components read it through useHostState.

let current: CourseState | null = null
const listeners = new Set<() => void>()

// Everything but the timestamp: a refresh that changed nothing must not
// re-render the map.
const contentKey = (state: CourseState) =>
  JSON.stringify([state.courseId, state.sections, state.activities, state.unavailableCmids])

export const getHostState = () => current

export const setHostState = (next: CourseState | null) => {
  if (next && current && contentKey(next) === contentKey(current)) return
  current = next
  listeners.forEach((listener) => listener())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

export const useHostState = () => useSyncExternalStore(subscribe, getHostState)
