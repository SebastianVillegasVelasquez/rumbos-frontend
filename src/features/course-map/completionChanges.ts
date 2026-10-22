import type { RenderableBubble } from './data/types.ts'

// Observed completion changes, per activity (cmid).
//
// A completion is "observed" only as a transition: an activity that was known
// and not complete, and now is. So nothing fires for the first state (there is
// no previous one), for an activity that merely appeared, for one that was
// already complete, or for any change that is not a completion (a lock, a
// rename). A completion that is undone and done again is a new transition.

export type CompletionSnapshot = ReadonlyMap<number, boolean>

export const snapshotOf = (bubbles: readonly RenderableBubble[]): CompletionSnapshot =>
  new Map(bubbles.map((bubble) => [bubble.activityId, bubble.status === 'complete']))

// The activities that just went from not complete to complete. `previous` is
// null for the first state, which only establishes the baseline.
export const newlyCompleted = (
  previous: CompletionSnapshot | null,
  current: CompletionSnapshot
): number[] => {
  if (!previous) return []
  const completed: number[] = []
  for (const [cmid, complete] of current) {
    if (complete && previous.get(cmid) === false) completed.push(cmid)
  }
  return completed
}
