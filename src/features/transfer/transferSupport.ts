import { useSyncExternalStore } from 'react'
import { isMissingRoute } from '../course-map/data/apiError.ts'

// Whether the running backend knows the export and import routes. Learned, never
// assumed: the buttons are offered until a call proves the routes are not there,
// then they are hidden. Module state, like content support: it is a fact about
// the backend, not about one component.
export type TransferSupport = 'unknown' | 'no'

let current: TransferSupport = 'unknown'
const listeners = new Set<() => void>()

export const getTransferSupport = () => current

const set = (next: TransferSupport) => {
  if (next === current) return
  current = next
  listeners.forEach((listener) => listener())
}

export { isMissingRoute }

export const learnFromTransferError = (error: unknown) => {
  if (isMissingRoute(error)) set('no')
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

export const useTransferSupported = () =>
  useSyncExternalStore(subscribe, getTransferSupport) !== 'no'

// For tests.
export const resetTransferSupport = () => set('unknown')
