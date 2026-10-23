import type { Availability, Bubble, BubbleStatus, MapMode } from './data/types.ts'

// What a bubble actually looks like, derived from its backend status, the
// map's mode, its place in the guided sequence, the resolved Moodle
// availability, and who's looking. This is the single source of truth for
// bubble appearance - BubbleVisual only renders one of these, it never
// re-derives it.
export type VisualState =
  | 'locked'
  | 'available'
  | 'next'
  | 'inProgress'
  | 'complete'
  // Open, but Moodle does not track its completion ("Sin seguimiento").
  | 'untracked'
  | 'teaser'
  | 'missing'
  | 'unknown'

export type MapView = 'editor' | 'student'

export interface DeriveVisualStateInput {
  status: BubbleStatus
  sequence: number
  mode: MapMode
  availability: Availability | undefined
  view: MapView
  // False when the activity has no completion tracking; absent means tracked.
  tracked?: boolean
  // The lowest `sequence` among this map's bubbles that are still
  // incomplete (status !== "complete"), or null if every bubble is
  // complete / there are no bubbles. Computed once per map by the caller
  // (see nextIncompleteSequence below) and passed in, so this function
  // stays pure and doesn't need the whole bubble list.
  nextIncompleteSequence: number | null
  // A content bubble: informational, always open, outside the sequence.
  informational?: boolean
}

// TODO(moodle-restrictions): "locked" for later guided-mode bubbles is a
// placeholder until real Moodle activity restrictions drive availability;
// today it's purely sequence-derived.
export function deriveVisualState(input: DeriveVisualStateInput): VisualState {
  const { status, sequence, mode, availability, view, nextIncompleteSequence } = input
  const tracked = input.tracked !== false

  if (input.informational) return 'available'
  if (availability === 'missing') return 'missing'
  if (availability === 'hidden' && view === 'student') return 'teaser'
  if (availability === 'unknown') return 'unknown'
  // A Moodle access restriction keeps the activity shut whatever its progress.
  if (availability === 'restricted') return 'locked'

  // Never complete, never "next", never blocked by the guided sequence.
  if (!tracked) return 'untracked'

  if (status === 'complete') return 'complete'
  if (status === 'in_progress') return 'inProgress'
  if (status === 'locked') return 'locked'

  // status === "no_complete"
  if (mode === 'explorative') return 'available'
  return nextIncompleteSequence !== null && sequence === nextIncompleteSequence ? 'next' : 'locked'
}

// Helper for the caller: the lowest `sequence` among bubbles that aren't yet
// complete, for guided mode's single "next" bubble.
//
// Only bubbles that count (see progress.ts) can be next; by default every
// tracked one does. Untracked bubbles never are.
export function nextIncompleteSequence<
  T extends Pick<Bubble, 'status' | 'sequence'> & { tracked?: boolean },
>(bubbles: T[], counts: (bubble: T) => boolean = () => true): number | null {
  const incomplete = bubbles.filter(
    (bubble) => bubble.tracked !== false && bubble.status !== 'complete' && counts(bubble)
  )
  if (incomplete.length === 0) return null
  return Math.min(...incomplete.map((bubble) => bubble.sequence))
}

// A visual state's role for the student: can they open it right now?
export function isVisualStateInteractive(state: VisualState): boolean {
  return (
    state === 'available' ||
    state === 'next' ||
    state === 'inProgress' ||
    state === 'complete' ||
    state === 'untracked'
  )
}
