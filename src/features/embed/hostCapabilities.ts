import { useSyncExternalStore } from 'react'
import { NO_CAPABILITIES, type HostCapabilities } from './protocol.ts'

// What the host announced in host-init (contract v5.10). Module state, like the other
// host facts, because the session writes it from a message listener. A host that
// predates v5.10 announces nothing, and nothing is on.

let current: HostCapabilities = NO_CAPABILITIES
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

export const getHostCapabilities = () => current

export const setHostCapabilities = (next: HostCapabilities) => {
  if (
    next.tutor === current.tutor &&
    next.activities === current.activities &&
    next.activity === current.activity
  )
    return
  current = next
  listeners.forEach((listener) => listener())
}

export const useHostTutorAvailable = () =>
  useSyncExternalStore(
    subscribe,
    () => current.tutor,
    () => false
  )

// Contract v5.11. `activity`: the host opens a course activity from a flow step; `activities`:
// it also lists them, for a map editor's step picker.
export const useHostActivityAvailable = () =>
  useSyncExternalStore(
    subscribe,
    () => current.activity,
    () => false
  )

export const useHostActivitiesListable = () =>
  useSyncExternalStore(
    subscribe,
    () => current.activities,
    () => false
  )

// The host closed the tutor: whoever opened it takes focus back.
const closedListeners = new Set<() => void>()
export const subscribeHostTutorClosed = (listener: () => void) => {
  closedListeners.add(listener)
  return () => void closedListeners.delete(listener)
}
export const notifyHostTutorClosed = () => closedListeners.forEach((listener) => listener())
