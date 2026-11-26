import { TriangleAlert } from 'lucide-react'
import type { Activity, Availability, MapMode, RenderableBubble as Bubble } from '../data/types.ts'
import { deriveVisualState, nextIncompleteSequence, type VisualState } from '../visualState.ts'
import { countsTowardProgress } from '../progress.ts'
import { isContentBubble } from '../../content/contentTypes.ts'
import { es } from '../../../i18n/es.ts'
import { Badge } from '../../../components/ui/Card.tsx'
import { Button } from '../../../components/ui/Button.tsx'

interface ActivitiesOverviewProps {
  bubbles: Bubble[]
  activities: Activity[]
  mode: MapMode
  view: 'editor' | 'student'
  getAvailability: (bubble: Bubble) => Availability | undefined
  onSelectBubble: (bubble: Bubble) => void
  // Editor, host speaking v5.4: open the activity's settings page in Moodle.
  onConfigureCompletion?: (cmid: number) => void
}

type GroupKey =
  'next' | 'complete' | 'in_progress' | 'available' | 'locked' | 'teaser' | 'unavailable'

const GROUP_FOR: Record<VisualState, GroupKey> = {
  next: 'next',
  complete: 'complete',
  inProgress: 'in_progress',
  available: 'available',
  untracked: 'available',
  locked: 'locked',
  teaser: 'teaser',
  missing: 'unavailable',
  unknown: 'unavailable',
}

const GROUP_ORDER: { key: GroupKey; tone: 'leaf' | 'teal' | 'sun' | 'slate' | 'coral' }[] = [
  { key: 'next', tone: 'sun' },
  { key: 'in_progress', tone: 'teal' },
  { key: 'available', tone: 'sun' },
  { key: 'complete', tone: 'leaf' },
  { key: 'locked', tone: 'slate' },
  { key: 'teaser', tone: 'slate' },
  { key: 'unavailable', tone: 'coral' },
]

// Display-only for this sprint: reads the same bubbles/activities already in
// state, doesn't touch points/scoring - that's a separate, backend-dependent
// feature. Doubles as the accessible, keyboard-navigable equivalent of the
// Konva canvas (see role="img" on MapCanvas's container) - grouped by the
// same deriveVisualState the canvas itself renders, so "next"/"teaser"/etc
// show up here exactly as they do on the map.
// The editor's Resumen section: the level's activities grouped by what a student would see.
export const ActivitiesOverviewBody = ({
  bubbles: allBubbles,
  activities,
  mode,
  view,
  getAvailability,
  onSelectBubble,
  onConfigureCompletion,
}: ActivitiesOverviewProps) => {
  // The overview lists Moodle activities; content bubbles are not among them.
  const bubbles = allBubbles.filter((bubble) => !isContentBubble(bubble))
  const activityById = new Map(activities.map((activity) => [activity.activityId, activity]))
  const nextSequence = nextIncompleteSequence(bubbles, (bubble) =>
    countsTowardProgress(bubble, getAvailability(bubble), view)
  )

  const byGroup = new Map<GroupKey, Bubble[]>()
  for (const bubble of bubbles) {
    const state = deriveVisualState({
      status: bubble.status,
      sequence: bubble.sequence,
      mode,
      availability: getAvailability(bubble),
      view,
      tracked: bubble.tracked,
      nextIncompleteSequence: nextSequence,
    })
    const key = GROUP_FOR[state]
    byGroup.set(key, [...(byGroup.get(key) ?? []), bubble])
  }

  return (
    <div className="min-w-0 space-y-5">
      {GROUP_ORDER.filter(({ key }) => (byGroup.get(key)?.length ?? 0) > 0).map(({ key, tone }) => {
        const groupMeta = es.overview.groups[key]
        const groupBubbles = byGroup.get(key) ?? []
        return (
          <section key={key}>
            <div className="mb-1 flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                {groupMeta.title}
              </h3>
              <Badge tone={tone}>{groupBubbles.length}</Badge>
            </div>
            <p className="mb-2 text-xs text-ink-soft">{groupMeta.description}</p>
            <ul className="grid min-w-0 gap-1.5 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
              {groupBubbles.map((bubble) => {
                const activity = activityById.get(bubble.activityId ?? -1)
                return (
                  <li key={bubble.id}>
                    <button
                      type="button"
                      onClick={() => onSelectBubble(bubble)}
                      className="flex min-h-[44px] w-full items-center justify-between rounded-md border-hair bg-surface-muted px-3 py-2 text-left text-sm transition-colors hover:bg-primary-tint"
                    >
                      <span className="min-w-0 truncate font-semibold text-ink">
                        {activity?.name ?? `#${String(bubble.activityId)}`}
                      </span>
                      {activity && (
                        <span className="ml-3 shrink-0 text-[11px] font-bold uppercase text-ink-soft">
                          {es.activityTypes[activity.modname as keyof typeof es.activityTypes] ??
                            es.activityTypes.default}
                        </span>
                      )}
                    </button>
                    {view === 'editor' &&
                      bubble.tracked === false &&
                      getAvailability(bubble) !== 'missing' && (
                        <div className="mt-1 flex flex-wrap items-center gap-2 px-1">
                          <Badge tone="sun">
                            <TriangleAlert size={13} strokeWidth={2.5} aria-hidden />
                            {es.completion.untracked}
                          </Badge>
                          {onConfigureCompletion && (
                            <Button
                              variant="secondary"
                              dense
                              size="sm"
                              aria-label={es.completion.configureAria(
                                activity?.name ?? `#${bubble.activityId}`
                              )}
                              onClick={() =>
                                bubble.activityId !== null &&
                                onConfigureCompletion(bubble.activityId)
                              }
                            >
                              {es.completion.configure}
                            </Button>
                          )}
                        </div>
                      )}
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
      {bubbles.length === 0 && (
        <p className="text-sm font-semibold text-ink-soft">{es.overview.empty}</p>
      )}
    </div>
  )
}
