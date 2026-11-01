import { useSyncExternalStore } from 'react'
import { ApiError } from '../course-map/data/apiError.ts'

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

// A route the server does not have answers 404, 405 or 501 with no business
// code in the body. A coded 404 (a level or an import that does not exist) is a
// real answer from a backend that does know the route.
export const isMissingRoute = (error: unknown): boolean =>
  error instanceof ApiError &&
  [404, 405, 501].includes(error.status) &&
  error.detail.code === 'unknown_error'

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
