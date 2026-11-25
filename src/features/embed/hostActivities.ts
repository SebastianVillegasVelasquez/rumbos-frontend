import { useSyncExternalStore } from 'react'
import type {
  ActivityOpenReason,
  HostActivitiesError,
  HostActivitiesMessage,
  HostActivityItem,
} from './protocol.ts'

// What the host (Moodle) said about course activities (contract v5.11): the list a map editor
// picks from, and what became of each activity the student asked to open. Memory only and
// dependency free, like hostFlow.ts: nothing here touches the network or storage, and the
// session end clears it.
//
// The rule that matters: an activity counts as SEEN only when this session asked for it, the
// host said it was on screen, and then said it closed. A stray `closed` (or one for another
// activity) completes nothing. The host owns what a student may open; this only remembers the
// conversation. Nothing here, or anywhere in the app, writes a student's Moodle completion.

export type ActivityList =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; items: HostActivityItem[] }
  | { status: 'error'; error: HostActivitiesError }

export type ActivityView =
  | { status: 'idle' }
  // Asked, no answer yet.
  | { status: 'opening' }
  // On screen in the host's overlay.
  | { status: 'open' }
  | { status: 'failed'; reason: ActivityOpenReason }
  // Opened, then closed: the student has seen it.
  | { status: 'seen' }

const IDLE_LIST: ActivityList = { status: 'idle' }
const IDLE_VIEW: ActivityView = { status: 'idle' }

let list: ActivityList = IDLE_LIST
let views = new Map<number, ActivityView>()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

export const getActivityList = () => list
export const getActivityView = (cmid: number): ActivityView => views.get(cmid) ?? IDLE_VIEW

const setView = (cmid: number, view: ActivityView) => {
  views = new Map(views).set(cmid, view)
  emit()
}

// The request went out: the answer is awaited.
export const markActivityListLoading = () => {
  list = { status: 'loading' }
  emit()
}

export const setHostActivities = (message: HostActivitiesMessage) => {
  list =
    message.error !== undefined
      ? { status: 'error', error: message.error }
      : { status: 'ready', items: message.items }
  emit()
}

// The app asked the host to open it (a retry starts here too).
export const markActivityOpening = (cmid: number) => setView(cmid, { status: 'opening' })

export const setHostActivityOpened = (cmid: number) => {
  // Only an answer to our own request: an unasked `opened` shows nothing.
  if (getActivityView(cmid).status === 'opening') setView(cmid, { status: 'open' })
}

export const setHostActivityOpenFailed = (cmid: number, reason: ActivityOpenReason) => {
  if (getActivityView(cmid).status === 'opening') setView(cmid, { status: 'failed', reason })
}

export const setHostActivityClosed = (cmid: number) => {
  // Seen only after it was on screen. A `closed` out of the blue completes nothing.
  if (getActivityView(cmid).status === 'open') setView(cmid, { status: 'seen' })
}

export const clearHostActivities = () => {
  if (list.status === 'idle' && views.size === 0) return
  list = IDLE_LIST
  views = new Map()
  emit()
}

export const useActivityList = () =>
  useSyncExternalStore(subscribe, getActivityList, () => IDLE_LIST)

export const useActivityView = (cmid: number) =>
  useSyncExternalStore(
    subscribe,
    () => getActivityView(cmid),
    () => IDLE_VIEW
  )
