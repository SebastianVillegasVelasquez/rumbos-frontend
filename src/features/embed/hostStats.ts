import { useSyncExternalStore } from 'react'
import type { CourseStats, HostStatsError } from './protocol.ts'

// The completion counts the host last sent (contract v5.7). Memory only, by
// design: this module imports nothing that talks to the network or to storage,
// and nothing ever reads these numbers except the heat map. Dropped when the
// heat map is switched off and when the session ends. Dependency free, like
// hostOverlay.ts.
export type HostStatsState =
  | { status: 'idle' }
  // A request is out. `previous` keeps the last numbers on screen during a refresh.
  | { status: 'loading'; previous: CourseStats | null }
  | { status: 'ready'; stats: CourseStats }
  | { status: 'error'; error: HostStatsError }
  // The host never answered: an older plugin that does not know v5.7.
  | { status: 'silent' }

const IDLE: HostStatsState = { status: 'idle' }

let current: HostStatsState = IDLE
const listeners = new Set<() => void>()

const set = (next: HostStatsState) => {
  current = next
  listeners.forEach((listener) => listener())
}

export const getHostStats = () => current

export const markStatsRequested = () => {
  const previous = current.status === 'ready' ? current.stats : null
  set({
    status: 'loading',
    previous: previous ?? (current.status === 'loading' ? current.previous : null),
  })
}

export const markStatsSilent = () => {
  if (current.status === 'loading') set({ status: 'silent' })
}

export const setHostStatsResult = (result: {
  stats: CourseStats | null
  error: HostStatsError | null
}) => {
  if (result.stats) set({ status: 'ready', stats: result.stats })
  else if (result.error) set({ status: 'error', error: result.error })
}

// Turning the heat map off, or the session ending: the numbers are gone.
export const clearHostStats = () => {
  if (current !== IDLE) set(IDLE)
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

export const useHostStats = () => useSyncExternalStore(subscribe, getHostStats)
