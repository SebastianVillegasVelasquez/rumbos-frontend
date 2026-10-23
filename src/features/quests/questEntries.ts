import type { Activity, Availability, MapMode, RenderableBubble } from '../course-map/data/types.ts'
import { isContentBubble } from '../content/contentTypes.ts'
import { continueTarget } from '../course-map/continueTarget.ts'
import { countsTowardProgress } from '../course-map/progress.ts'
import {
  deriveVisualState,
  nextIncompleteSequence,
  type VisualState,
} from '../course-map/visualState.ts'

export type QuestGroup = 'next' | 'available' | 'complete' | 'locked' | 'upcoming' | 'info'

export const QUEST_GROUP_ORDER: readonly QuestGroup[] = [
  'next',
  'available',
  'complete',
  'locked',
  'upcoming',
  'info',
]

export interface QuestEntry {
  bubbleId: string
  // Null for a content bubble.
  cmid: number | null
  state: VisualState
  group: QuestGroup
  // Null for an activity the student must not be told about: the list says
  // "Próximamente" and never carries the real name.
  name: string | null
  // Plain-text availability info from Moodle, for restricted activities.
  info: string | null
  // Can it be opened right now (the secondary "Abrir" action).
  openable: boolean
  // Information only: the viewer has already opened it (viewer-local).
  seen: boolean
}

const OPENABLE: ReadonlySet<VisualState> = new Set([
  'next',
  'available',
  'inProgress',
  'complete',
  'untracked',
])

const groupFor = (state: VisualState, isTarget: boolean): QuestGroup => {
  if (isTarget) return 'next'
  switch (state) {
    case 'complete':
      return 'complete'
    case 'teaser':
      return 'upcoming'
    case 'locked':
    case 'missing':
    case 'unknown':
      return 'locked'
    default:
      return 'available'
  }
}

interface Input {
  bubbles: readonly RenderableBubble[]
  mode: MapMode
  availabilityOf: (bubble: RenderableBubble) => Availability | undefined
  activityOf: (bubble: RenderableBubble) => Activity | null | undefined
  // Whether this viewer has opened a content bubble. Defaults to never.
  seenOf?: (bubble: RenderableBubble) => boolean
}

// The quest log's rows, by group and in sequence order. It reads the same
// derivation the map draws (deriveVisualState), so a bubble is "locked" here
// exactly when it looks locked there. The "Siguiente" group holds the activity
// "Continuar" points at.
export const buildQuestEntries = ({
  bubbles,
  mode,
  availabilityOf,
  activityOf,
  seenOf,
}: Input): Record<QuestGroup, QuestEntry[]> => {
  const target = continueTarget(bubbles, mode, availabilityOf, 'student')
  const nextSequence = nextIncompleteSequence([...bubbles], (bubble) =>
    countsTowardProgress(bubble, availabilityOf(bubble), 'student')
  )

  const groups: Record<QuestGroup, QuestEntry[]> = {
    next: [],
    available: [],
    complete: [],
    locked: [],
    upcoming: [],
    info: [],
  }

  for (const bubble of [...bubbles].sort((a, b) => a.sequence - b.sequence)) {
    if (isContentBubble(bubble)) {
      groups.info.push({
        bubbleId: bubble.id,
        cmid: null,
        state: 'available',
        group: 'info',
        name: bubble.content?.title.trim() || null,
        info: null,
        openable: true,
        seen: seenOf?.(bubble) ?? false,
      })
      continue
    }
    const availability = availabilityOf(bubble)
    const state = deriveVisualState({
      status: bubble.status,
      sequence: bubble.sequence,
      mode,
      availability,
      view: 'student',
      tracked: bubble.tracked,
      nextIncompleteSequence: nextSequence,
    })
    const group = groupFor(state, target?.id === bubble.id)
    const activity = state === 'teaser' ? null : activityOf(bubble)
    groups[group].push({
      bubbleId: bubble.id,
      cmid: bubble.activityId,
      state,
      group,
      name: activity?.name.trim() || null,
      info:
        state === 'locked' && availability === 'restricted'
          ? activity?.availabilityInfo?.trim() || null
          : null,
      openable: OPENABLE.has(state),
      seen: false,
    })
  }
  return groups
}
