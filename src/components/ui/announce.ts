import { useSyncExternalStore } from 'react'

// Messages for screen readers only. A single polite live region (LiveRegion)
// stays mounted for the app's lifetime, because text injected into a region
// that is created in the same instant is often not announced.

interface Announcement {
  id: number
  message: string
}

let current: Announcement = { id: 0, message: '' }
const listeners = new Set<() => void>()

export const announce = (message: string) => {
  current = { id: current.id + 1, message }
  listeners.forEach((listener) => listener())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

export const useAnnouncement = () => useSyncExternalStore(subscribe, () => current)
