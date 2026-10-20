import { useSyncExternalStore } from 'react'

// Whether the host has an overlay (an activity popup) open above the app. While
// it is, the app pauses its animation loops and starts no new transitions. The
// host is the source of truth (rumbos:host-overlay); this module is dependency
// free so the shared ticker can read it without pulling in any embed code.
let current = false
const listeners = new Set<() => void>()

export const isHostOverlayOpen = () => current

export const setHostOverlayOpen = (next: boolean) => {
  if (next === current) return
  current = next
  listeners.forEach((listener) => listener())
}

export const subscribeHostOverlay = (listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

export const useHostOverlayOpen = () =>
  useSyncExternalStore(subscribeHostOverlay, isHostOverlayOpen)
