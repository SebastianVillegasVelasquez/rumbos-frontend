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
  if (next.tutor === current.tutor) return
  current = next
  listeners.forEach((listener) => listener())
}

export const useHostTutorAvailable = () =>
  useSyncExternalStore(
    subscribe,
    () => current.tutor,
    () => false
  )

// The host closed the tutor: whoever opened it takes focus back.
const closedListeners = new Set<() => void>()
export const subscribeHostTutorClosed = (listener: () => void) => {
  closedListeners.add(listener)
  return () => void closedListeners.delete(listener)
}
export const notifyHostTutorClosed = () => closedListeners.forEach((listener) => listener())
