import { useSyncExternalStore } from 'react'

// Contract v5.4: while fullscreen is on, the host owns an exit control in the
// top-right 64x64 CSS px of the viewport, always above the app. The app keeps
// that square free of anything interactive and hides its own fullscreen toggle.
export const RESERVED_CORNER_PX = 64

// Whether the host has the iframe expanded. The host is the only source of
// truth (host-fullscreen): the app asks to enter but never assumes it did, so
// the state only changes when the host says so.
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
