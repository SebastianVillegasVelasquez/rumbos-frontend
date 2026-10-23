import type { Availability, RenderableBubble } from './data/types.ts'
import { isContentBubble } from '../content/contentTypes.ts'
import type { MapView } from './visualState.ts'

// What counts as progress. Only activities Moodle tracks can become complete,
// so only those count; an untracked one is "Sin seguimiento" and stays out of
// both sides of the fraction. Activities the person cannot see (a student's
// "Próximamente" teasers) and ones that no longer exist stay out too: their
// completion is unknown or irrelevant, and counting them would let a level
// that is entirely done read as unfinished.

export const isTracked = (bubble: Pick<RenderableBubble, 'tracked'>) => bubble.tracked !== false

// Whether a bubble is part of the progress fraction for this viewer.
export const countsTowardProgress = (
  bubble: Pick<RenderableBubble, 'tracked' | 'kind'>,
  availability: Availability | undefined,
  view: MapView
): boolean => {
  // Content is information, not an activity: it never counts.
  if (isContentBubble(bubble)) return false
  if (!isTracked(bubble)) return false
  if (availability === 'missing') return false
  if (availability === 'hidden' && view === 'student') return false
  return true
}

export interface ProgressCounts {
  // Tracked, visible activities: the denominator.
  total: number
  completed: number
  // Visible activities Moodle does not track.
  untracked: number
  // 0..100, or null when nothing is tracked (no meaningful percentage).
  percent: number | null
  // Nothing in the level records progress: say so instead of "0 de 0".
  nothingTracked: boolean
  // Every tracked activity is complete (and there is at least one).
  allComplete: boolean
}

export const progressCounts = (
  bubbles: RenderableBubble[],
  availabilityOf: (bubble: RenderableBubble) => Availability | undefined,
  view: MapView = 'student'
): ProgressCounts => {
  let total = 0
  let completed = 0
  let untracked = 0
  for (const bubble of bubbles) {
    if (isContentBubble(bubble)) continue
    const availability = availabilityOf(bubble)
    if (availability === 'missing' || (availability === 'hidden' && view === 'student')) continue
    if (!isTracked(bubble)) {
      untracked++
      continue
    }
    total++
    if (bubble.status === 'complete') completed++
  }
  return {
    total,
    completed,
    untracked,
    percent: total > 0 ? Math.round((completed / total) * 100) : null,
    nothingTracked: total === 0 && bubbles.some((bubble) => !isContentBubble(bubble)),
    allComplete: total > 0 && completed === total,
  }
}
