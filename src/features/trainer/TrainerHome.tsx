import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ChartNoAxesColumn, Layers } from 'lucide-react'
import { Button } from '../../components/ui/Button.tsx'
import { esTrainer } from '../../i18n/trainer.es.ts'
import { trainerApi } from './api.ts'
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

export interface HomeProps {
  catalog: Catalog
  onBack: () => void
  onLessons: () => void
  onProgress: () => void
}

// S2: the way to the lessons and to the progress. Practice only: the final exam is a step
// of the closing flow. The words due live in the progress screen.
export const TrainerHome = ({ catalog, onBack, onLessons, onProgress }: HomeProps) => {
  const ref = useRef<HTMLHeadingElement>(null)
  const client = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleted, setDeleted] = useState(false)
  useEffect(() => ref.current?.focus(), [])
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
