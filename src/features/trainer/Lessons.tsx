import { useEffect, useRef } from 'react'
import { ArrowLeft, Lock } from 'lucide-react'
import { Button } from '../../components/ui/Button.tsx'
import { esTrainer } from '../../i18n/trainer.es.ts'
import { TrainerCard } from './TrainerCard.tsx'
import type { Catalog } from './types.ts'

const text = esTrainer

// Editors in preview learn which items students cannot see yet. Said in words, and
// only when the catalog says so (a backend without the field shows nothing).
const Unpublished = ({ published }: { published?: boolean }) =>
  published === false ? (
    <span className="rounded-pill bg-sun-tint px-2 text-xs font-bold text-sun-dark">
      {text.publication.unpublished}
    </span>
  ) : null

// S3 "Elige una lección": the catalog's lessons grouped by module, each with its
// activities. A locked lesson or activity says so in words, not only with a lock.
export const Lessons = ({
  catalog,
  onBack,
  onStart,
}: {
  catalog: Catalog
  onBack: () => void
  onStart: (activityId: string) => void
}) => {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => ref.current?.focus(), [])
  const lessons = catalog.lessons ?? []
  const modules = catalog.modules ?? []

  return (
    <TrainerCard
      ref={ref}
      title={text.lessons.title}
      preview={catalog.preview}
      footer={
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft size={18} strokeWidth={3} aria-hidden />
          {text.backToHome}
        </Button>
      }
    >
      {lessons.length === 0 && <p>{text.home.empty}</p>}
      {modules.map((module) => {
        const inModule = lessons.filter((lesson) => lesson.module === module.key)
        if (inModule.length === 0) return null
        return (
          <section key={module.key} aria-labelledby={`mod-${module.key}`}>
            <h3 id={`mod-${module.key}`} className="font-heading text-lg font-extrabold">
              {text.lessons.module(module.title)}
            </h3>
            <ul className="mt-2 flex flex-col gap-3">
              {inModule.map((lesson) => {
                const activities = (catalog.activities ?? []).filter(
                  (activity) => activity.lesson_id === lesson.id
                )
                return (
                  <li key={lesson.id} className="rounded-lg border-soft bg-surface p-3">
                    <p className="flex flex-wrap items-center gap-2 font-bold">
                      <span className="rounded-pill border-soft px-2 text-sm">{lesson.code}</span>
                      {lesson.title}
                      {catalog.preview && <Unpublished published={lesson.published} />}
                      {lesson.locked && (
                        <span className="inline-flex items-center gap-1 text-sm text-ink-soft">
                          <Lock size={14} strokeWidth={2.5} aria-hidden />
                          {text.lessons.locked}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-ink-soft">
                      {lesson.locked ? text.lessons.lockedHint : lesson.description}
                    </p>
                    {!lesson.locked && activities.length > 0 && (
                      <ul className="mt-2 flex flex-col gap-2">
                        {activities.map((activity) => (
                          <li
                            key={activity.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-muted p-2"
                          >
                            <span className="min-w-0">
                              <span className="flex flex-wrap items-center gap-2 font-semibold">
                                {activity.title}
                                {catalog.preview && <Unpublished published={activity.published} />}
                              </span>
                              <span className="block text-xs text-ink-soft">
                                {text.home.skillNames[activity.skill]} ·{' '}
                                {text.lessons.minutes(activity.estimated_minutes)} ·{' '}
                                {text.intro.steps(activity.step_count)} ·{' '}
                                {text.lessons.done(activity.completed_count)}
                                {activity.best_score !== null &&
                                  ` · ${text.lessons.best(Math.round(activity.best_score))}`}
                              </span>
                            </span>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={activity.locked}
                              aria-label={`${text.lessons.open}: ${activity.title}`}
                              onClick={() => onStart(activity.id)}
                            >
                              {activity.locked ? text.lessons.activityLocked : text.lessons.open}
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </TrainerCard>
  )
}
