import { useSyncExternalStore } from 'react'

// Whether the host has the iframe expanded. The host is the source of truth
// (host-fullscreen), but pressing the button flips it at once so the control
// does not wait for a round trip; the host's next message overrides the guess.
let current = false
const listeners = new Set<() => void>()

export const getHostFullscreen = () => current

export const setHostFullscreen = (next: boolean) => {
  if (next === current) return
  current = next
  listeners.forEach((listener) => listener())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

export const useHostFullscreen = () => useSyncExternalStore(subscribe, getHostFullscreen)
