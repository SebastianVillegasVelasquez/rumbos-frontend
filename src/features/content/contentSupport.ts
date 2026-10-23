import { useSyncExternalStore } from 'react'

// Whether the running backend knows content bubbles. It is learned, never
// assumed: a bubble that carries `kind` proves it, a rejected or ignored create
// disproves it. While unknown, the editor offers the feature (a map without
// bubbles has nothing to learn from); once disproved, it is hidden instead of
// failing. Module state, like the host overlay flag: it is a fact about the
// backend, not about one component.
export type ContentSupport = 'unknown' | 'yes' | 'no'

let current: ContentSupport = 'unknown'
const listeners = new Set<() => void>()

export const getContentSupport = () => current

export const setContentSupport = (next: ContentSupport) => {
  if (next === current) return
  current = next
  listeners.forEach((listener) => listener())
}

// A backend that sends `kind` on any bubble speaks content bubbles.
export const learnFromBubbles = (bubbles: ReadonlyArray<{ kind?: string }>) => {
  if (bubbles.some((bubble) => typeof bubble.kind === 'string')) setContentSupport('yes')
}

// A create with kind "content" that the backend refused as a malformed body
// (not with one of the content codes) or answered with a bubble that is not
// content: it does not know the field.
const CONTENT_CODES = new Set(['content_invalid', 'content_too_large', 'widgets_disabled'])

export const learnFromCreateFailure = (error: { status?: number; code?: string }) => {
  if ((error.status === 400 || error.status === 422) && !CONTENT_CODES.has(error.code ?? ''))
    setContentSupport('no')
}

export const learnFromCreated = (bubble: { kind?: string }) => {
  setContentSupport(bubble.kind === 'content' ? 'yes' : 'no')
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

export const useContentSupported = () => useSyncExternalStore(subscribe, getContentSupport) !== 'no'

// For tests.
export const resetContentSupport = () => setContentSupport('unknown')
