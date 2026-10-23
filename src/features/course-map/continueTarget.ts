import type { Availability, MapMode, RenderableBubble } from './data/types.ts'
import { isContentBubble } from '../content/contentTypes.ts'
import { countsTowardProgress } from './progress.ts'
import { deriveVisualState, nextIncompleteSequence, type MapView } from './visualState.ts'

// What "Continuar" points at: the first activity, by sequence, that is tracked,
// not complete and open right now. In guided mode that is the "next" bubble (or
// one in progress); in explorative mode every open incomplete bubble qualifies
// and the lowest sequence wins. Untracked, complete, locked and hidden
// activities are never the target, so the button hides itself when nothing
// that records progress is left to do.
export const continueTarget = (
  bubbles: readonly RenderableBubble[],
  mode: MapMode,
  availabilityOf: (bubble: RenderableBubble) => Availability | undefined,
  view: MapView = 'student'
): RenderableBubble | null => {
  const nextSequence = nextIncompleteSequence([...bubbles], (bubble) =>
    countsTowardProgress(bubble, availabilityOf(bubble), view)
  )
  const candidates = [...bubbles]
    .sort((a, b) => a.sequence - b.sequence)
    .filter((bubble) => {
      if (isContentBubble(bubble)) return false
      const state = deriveVisualState({
        status: bubble.status,
        sequence: bubble.sequence,
        mode,
        availability: availabilityOf(bubble),
        view,
        tracked: bubble.tracked,
        nextIncompleteSequence: nextSequence,
      })
      return state === 'next' || state === 'available' || state === 'inProgress'
    })
  return candidates[0] ?? null
}
