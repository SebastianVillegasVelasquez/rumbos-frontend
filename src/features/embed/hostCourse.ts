import { useSyncExternalStore } from 'react'

// The course's name, as the host sent it in host-init (contract v5.6). Plain
// text from a host we do not control: render it with React text nodes only.
// Null from a host that predates v5.6, or before the handshake. Dependency
// free, like hostOverlay.ts.
let current: string | null = null
const listeners = new Set<() => void>()

export const setHostCourseName = (next: string | null) => {
  if (next === current) return
  current = next
  listeners.forEach((listener) => listener())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

export const useHostCourseName = () => useSyncExternalStore(subscribe, () => current)
