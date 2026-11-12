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
  JSON.stringify([
    state.courseId,
    state.sections,
    state.activities,
    state.unavailableCmids,
    state.courseCompletionEnabled,
  ])

export const getHostState = () => current

// How many states the host has sent, changed or not. A refresh that changed
// nothing does not re-render, but it does tell the app the host answered.
let receivedCount = 0
export const getHostStateReceivedCount = () => receivedCount

// Told on EVERY state the host sends, changed or not: the welcome flow asks for a
// quiz result after each one, because a refresh that changed nothing in the course
// state can still follow an attempt that finished.
const receivedListeners = new Set<() => void>()
export const subscribeHostStateReceived = (listener: () => void) => {
  receivedListeners.add(listener)
  return () => void receivedListeners.delete(listener)
}

export const setHostState = (next: CourseState | null) => {
  if (next) {
    receivedCount++
    receivedListeners.forEach((listener) => listener())
  }
  if (next && current && contentKey(next) === contentKey(current)) return
  current = next
  listeners.forEach((listener) => listener())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

export const useHostState = () => useSyncExternalStore(subscribe, getHostState)

// Whether completion tracking is enabled for the course; null while unknown
// (no state yet, or a host that predates contract v5.4).
export const completionEnabledOf = (state: CourseState | null): boolean | null =>
  state?.courseCompletionEnabled ?? null

export const useHostCompletionEnabled = () =>
  completionEnabledOf(useSyncExternalStore(subscribe, getHostState))

// A host that sends courseCompletionEnabled speaks v5.4, so it understands
// open-activity-settings; an older one would ignore the message.
export const useHostSupportsActivitySettings = () => useHostCompletionEnabled() !== null
