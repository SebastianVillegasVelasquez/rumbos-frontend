import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ChartNoAxesColumn, Layers } from 'lucide-react'
import { Button } from '../../components/ui/Button.tsx'
import { esAssessment } from '../../i18n/assessment.es.ts'
import { esTrainer } from '../../i18n/trainer.es.ts'
import { assessmentApi } from '../assessment/api.ts'
import type { AssessmentListItem, EnabledAssessmentList } from '../assessment/types.ts'
import { trainerApi } from './api.ts'
import { lockedReasonText } from '../assessment/lockedReason.ts'
import { rememberAccepted } from './firstUse.ts'
import { TrainerCard } from './TrainerCard.tsx'
import type { Catalog } from './types.ts'

const text = esTrainer
export const FirstUse = ({ onAccept, onBack }: { onAccept: () => void; onBack: () => void }) => {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => ref.current?.focus(), [])
  return (
    <TrainerCard
      ref={ref}
      title={text.first.title}
      footer={
        <>
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft size={18} strokeWidth={3} aria-hidden />
            {text.back}
          </Button>
          <Button
            onClick={() => {
              rememberAccepted()
              onAccept()
            }}
          >
            {text.first.accept}
          </Button>
        </>
      }
    >
      <p>{text.first.what}</p>
      <p className="rounded-md bg-primary-tint p-3 font-semibold">{text.first.notice}</p>
      <p className="text-sm">{text.first.store}</p>
    </TrainerCard>
  )
}

const FinalCard = ({
  list,
  onOpen,
}: {
  list: EnabledAssessmentList
  onOpen: (item: AssessmentListItem) => void
}) => {
  const item = list.items.find((entry) => entry.purpose === 'final')
  if (!item) return null
  const copy = esAssessment.finalCard
  const canOpen = item.state === 'available' || item.state === 'in_progress'
  return (
    <section
      aria-labelledby="trainer-final"
      className="flex flex-col gap-2 rounded-lg border-strong bg-sun-tint p-4"
    >
      <h3 id="trainer-final" className="font-heading text-lg font-extrabold">
        {copy.title}
      </h3>
      <p>{copy.body(list.policy.time_limit_min)}</p>
      <p className="text-sm font-bold">
        {copy.attempts(item.attempts.used, item.attempts.max)} · {copy.states[item.state]}
      </p>
      {item.locked_reason && <p className="text-sm">{lockedReasonText(item.locked_reason)}</p>}
      <div>
        <Button size="sm" disabled={!canOpen} onClick={() => onOpen(item)}>
          {copy.open}
        </Button>
      </div>
    </section>
  )
}

export interface HomeProps {
  catalog: Catalog
  onBack: () => void
  onLessons: () => void
  onProgress: () => void
  onFinal: (item: AssessmentListItem, list: EnabledAssessmentList) => void
}

// S2: the way to the lessons and to the progress, and the final exam card (clearly
// separated from practice). The words due live in the progress screen.
export const TrainerHome = ({ catalog, onBack, onLessons, onProgress, onFinal }: HomeProps) => {
  const ref = useRef<HTMLHeadingElement>(null)
  const client = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleted, setDeleted] = useState(false)
  useEffect(() => ref.current?.focus(), [])
  // The final exam is optional: a failure here never hides the practice.
  const exams = useQuery({
    queryKey: ['trainer', 'assessments'],
    queryFn: () => assessmentApi.list(),
    retry: false,
  })
  const examList = exams.data?.enabled ? exams.data : null
  const copy = text.home

  return (
    <TrainerCard
      ref={ref}
      title={catalog.title ?? copy.title(catalog.language?.name ?? '')}
      kicker={catalog.level ? copy.level(catalog.level) : undefined}
      preview={catalog.preview}
      footer={
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft size={18} strokeWidth={3} aria-hidden />
          {text.back}
        </Button>
      }
    >
      <div className="flex flex-wrap gap-2">
        <Button onClick={onLessons}>
          <Layers size={18} strokeWidth={2.5} aria-hidden />
          {copy.chooseLesson}
        </Button>
        <Button variant="secondary" onClick={onProgress}>
          <ChartNoAxesColumn size={18} strokeWidth={2.5} aria-hidden />
          {copy.progress}
        </Button>
      </div>

      {examList && <FinalCard list={examList} onOpen={(item) => onFinal(item, examList)} />}

      <div className="border-t-soft pt-3">
        {deleted ? (
          <p role="status" className="text-sm">
            {copy.deleteDone}
          </p>
        ) : confirmDelete ? (
          <div
            role="group"
            aria-label={copy.deleteData}
            className="flex flex-wrap items-center gap-2"
          >
            <span className="text-sm font-semibold">{copy.deleteConfirm}</span>
            <Button size="sm" variant="secondary" onClick={() => setConfirmDelete(false)}>
              {text.run.exitStay}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                trainerApi
                  .deleteMine()
                  .then(() => {
                    setDeleted(true)
                    setConfirmDelete(false)
                    void client.invalidateQueries({ queryKey: ['trainer'] })
                  })
                  .catch(() => setConfirmDelete(false))
              }
            >
              {copy.deleteData}
            </Button>
          </div>
        ) : (
          <button
            type="button"
            className="min-h-[44px] text-sm font-bold text-primary underline underline-offset-4"
            onClick={() => setConfirmDelete(true)}
          >
            {copy.deleteData}
          </button>
        )}
      </div>
    </TrainerCard>
  )
}
