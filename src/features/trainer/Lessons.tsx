import { useEffect, useRef } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '../../components/ui/Button.tsx'
import { esTrainer } from '../../i18n/trainer.es.ts'
import { publicationLabel, studentsCanSee } from './publication.ts'
import { TrainerCard } from './TrainerCard.tsx'
import type { Catalog } from './types.ts'

const text = esTrainer

// Editors in preview see each item's publication_state, in words. Only when the
// catalog sends it (a backend without the field shows nothing).
const Publication = ({ state }: { state?: string }) => {
  const label = publicationLabel(state, text.publication)
  if (label === null) return null
  const visible = studentsCanSee(state)
  return (
    <span
      className={`rounded-pill px-2 text-xs font-bold ${visible === false ? 'bg-sun-tint text-sun-dark' : 'border-hair text-ink-soft'}`}
    >
      {label}
    </span>
  )
}

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
  const modules = catalog.modules ?? []
  // Only the server's own list decides there is nothing to show.
  const empty = !modules.some((module) => module.lessons.length > 0)

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
      {empty && <p>{text.home.empty}</p>}
      {modules.map((module) => {
        if (module.lessons.length === 0) return null
        return (
          <section key={module.key} aria-labelledby={`mod-${module.key}`}>
            <h3 id={`mod-${module.key}`} className="font-heading text-lg font-extrabold">
              {text.lessons.module(module.title)}
            </h3>
            <ul className="mt-2 flex flex-col gap-3">
              {module.lessons.map((lesson) => (
                <li key={lesson.id} className="rounded-lg border-soft bg-surface p-3">
                  <p className="flex flex-wrap items-center gap-2 font-bold">
                    <span className="rounded-pill border-soft px-2 text-sm">{lesson.code}</span>
                    {lesson.title}
                  </p>
                  <p className="text-sm text-ink-soft">{lesson.description}</p>
                  {lesson.activities.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-2">
                      {lesson.activities.map((activity) => (
                        <li
                          key={activity.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-muted p-2"
                        >
                          <span className="min-w-0">
                            <span className="flex flex-wrap items-center gap-2 font-semibold">
                              {activity.title}
                              {catalog.preview && (
                                <Publication state={activity.publication_state} />
                              )}
                            </span>
                            <span className="block text-xs text-ink-soft">
                              {text.home.skillNames[activity.skill]} ·{' '}
                              {text.lessons.minutes(activity.estimated_minutes)} ·{' '}
                              {text.intro.steps(activity.step_count)} ·{' '}
                              {text.lessons.state[activity.state]}
                              {activity.best_percent !== null &&
                                ` · ${text.lessons.best(Math.round(activity.best_percent))}`}
                            </span>
                          </span>
                          <Button
                            size="sm"
                            variant="secondary"
                            aria-label={`${text.lessons.open}: ${activity.title}`}
                            onClick={() => onStart(activity.id)}
                          >
                            {text.lessons.open}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </TrainerCard>
  )
}
