import { ArrowRight } from 'lucide-react'
import type { Activity, RenderableBubble as Bubble } from '../data/types.ts'
import { es } from '../../../i18n/es.ts'
import { Card } from '../../../components/ui/Card.tsx'
import { ProgressBar } from '../../../components/ui/Skeleton.tsx'
import { Button } from '../../../components/ui/Button.tsx'

interface StudentHudProps {
  bubbles: Bubble[]
  activities: Activity[]
  onContinue: (bubble: Bubble) => void
  // Present only when this level is complete and another level follows it
  // in the course.
  onNextLevel?: () => void
}

// Derived entirely from the existing `status` field (see the sprint brief):
// real per-student completion will come from Moodle completion data later.
export const StudentHud = ({ bubbles, activities, onContinue, onNextLevel }: StudentHudProps) => {
  if (bubbles.length === 0) return null

  const completed = bubbles.filter((bubble) => bubble.status === 'complete').length
  const allComplete = completed === bubbles.length
  const next = bubbles.find(
    (bubble) => bubble.status === 'no_complete' || bubble.status === 'in_progress'
  )
  const nextActivity = next
    ? activities.find((activity) => activity.activityId === next.activityId)
    : undefined

  return (
    <Card
      variant="item"
      className="pointer-events-auto absolute left-1/2 top-2 z-10 w-[min(calc(100%-1rem),22rem)] -translate-x-1/2 space-y-1.5 p-2.5 hover:bg-surface sm:top-3 sm:space-y-2 sm:p-3.5"
    >
      <p className="text-sm font-bold text-ink">{es.hud.progress(completed, bubbles.length)}</p>
      <ProgressBar value={completed} max={bubbles.length} />
      {allComplete && onNextLevel ? (
        <Button size="sm" className="w-full" onClick={onNextLevel}>
          <span className="min-w-0 truncate">{es.levels.goToNextLevel}</span>
          <ArrowRight size={16} strokeWidth={3} className="shrink-0" />
        </Button>
      ) : (
        next &&
        nextActivity && (
          <Button size="sm" variant="secondary" className="w-full" onClick={() => onContinue(next)}>
            <span className="min-w-0 truncate">{es.hud.continue(nextActivity.name)}</span>
            <ArrowRight size={16} strokeWidth={3} className="shrink-0" />
          </Button>
        )
      )}
    </Card>
  )
}
