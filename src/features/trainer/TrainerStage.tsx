import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Button } from '../../components/ui/Button.tsx'
import { esTrainer } from '../../i18n/trainer.es.ts'
import { resolveImageUrl } from '../course-map/data/assets.ts'
import type { AssessmentList, AssessmentListItem } from '../assessment/types.ts'
import { LazyExamRunner } from '../assessment/LazyExamRunner.tsx'
import { trainerApi } from './api.ts'
import { classifyFailure } from './failure.ts'
import { Lessons } from './Lessons.tsx'
import { PracticeRunner } from './PracticeRunner.tsx'
import { Progress, VocabReview } from './Progress.tsx'
import { TrainerCard } from './TrainerCard.tsx'
import { wasAccepted } from './firstUse.ts'
import { FirstUse, TrainerHome } from './TrainerHome.tsx'

const text = esTrainer
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'
const CLOSE_MS = 150

type View =
  | { name: 'first' }
  | { name: 'home' }
  | { name: 'lessons' }
  | { name: 'practice'; activityId: string }
  | { name: 'progress' }
  | { name: 'review' }
  | { name: 'exam'; item: AssessmentListItem; list: AssessmentList }

export interface TrainerStageProps {
  imageUrl: string
  // Closes the stage. The HUD gives the focus back to the "Entrenar" button.
  onClose: () => void
}

// The practice trainer: a dialog over the blurred map with the welcome flow's card.
// Esc and "Volver al mapa" always close it; focus goes to the title of each screen
// and back to the button on close. Nothing of ours enters the top-right corner the
// host keeps for its exit control.
const TrainerStage = ({ imageUrl, onClose }: TrainerStageProps) => {
  const rootRef = useRef<HTMLDivElement>(null)
  const client = useQueryClient()
  const [closing, setClosing] = useState(false)
  const [view, setView] = useState<View>(() =>
    wasAccepted() ? { name: 'home' } : { name: 'first' }
  )

  const catalog = useQuery({
    queryKey: ['trainer', 'catalog'],
    queryFn: trainerApi.catalog,
    retry: 1,
  })

  const close = useCallback(() => {
    setClosing(true)
    window.setTimeout(onClose, CLOSE_MS)
  }, [onClose])

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        close()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [close])

  const trap = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') return
    const items = [...(rootRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const home = () => setView({ name: 'home' })
  const backFooter = (
    <Button variant="ghost" onClick={close}>
      <ArrowLeft size={18} strokeWidth={3} aria-hidden />
      {text.back}
    </Button>
  )

  let screen: React.ReactNode
  if (catalog.isPending) {
    screen = (
      <TrainerCard title={text.title} busy footer={backFooter}>
        <p role="status">{text.loading}</p>
      </TrainerCard>
    )
  } else if (catalog.isError) {
    const failure = classifyFailure(catalog.error)
    screen = (
      <TrainerCard
        title={text.title}
        footer={
          <>
            {backFooter}
            {failure !== 'unauthorized' && failure !== 'closed' && (
              <Button onClick={() => void catalog.refetch()}>{text.errors.retry}</Button>
            )}
          </>
        }
      >
        <p role="alert" className="font-semibold text-danger">
          {failure === 'unauthorized'
            ? text.errors.unauthorized
            : failure === 'closed'
              ? text.unavailable
              : text.errors.unreachable}
        </p>
      </TrainerCard>
    )
  } else if (!catalog.data.enabled) {
    screen = (
      <TrainerCard title={text.title} footer={backFooter}>
        <p role="status">{text.unavailable}</p>
      </TrainerCard>
    )
  } else if (view.name === 'first') {
    screen = <FirstUse onAccept={home} onBack={close} />
  } else if (view.name === 'lessons') {
    screen = (
      <Lessons
        catalog={catalog.data}
        onBack={home}
        onStart={(activityId) => setView({ name: 'practice', activityId })}
      />
    )
  } else if (view.name === 'practice') {
    screen = (
      <PracticeRunner
        key={view.activityId}
        activityId={view.activityId}
        onBack={() => {
          void client.invalidateQueries({ queryKey: ['trainer', 'catalog'] })
          home()
        }}
        onNextActivity={(activityId) => setView({ name: 'practice', activityId })}
        onChooseLesson={() => {
          void client.invalidateQueries({ queryKey: ['trainer', 'catalog'] })
          setView({ name: 'lessons' })
        }}
      />
    )
  } else if (view.name === 'progress') {
    screen = <Progress onBack={home} onReview={() => setView({ name: 'review' })} />
  } else if (view.name === 'review') {
    screen = <VocabReview onBack={home} />
  } else if (view.name === 'exam') {
    screen = (
      <LazyExamRunner
        purpose="final"
        info={view.item}
        policy={view.list.policy}
        preview={view.list.preview}
        onExit={() => {
          void client.invalidateQueries({ queryKey: ['trainer', 'assessments'] })
          home()
        }}
        onAgain={() => setView({ name: 'exam', item: view.item, list: view.list })}
      />
    )
  } else {
    screen = (
      <TrainerHome
        catalog={catalog.data}
        onBack={close}
        onStart={(activityId) => setView({ name: 'practice', activityId })}
        onLessons={() => setView({ name: 'lessons' })}
        onProgress={() => setView({ name: 'progress' })}
        onReview={() => setView({ name: 'review' })}
        onFinal={(item, list) => setView({ name: 'exam', item, list })}
      />
    )
  }

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={text.title}
      data-state={closing ? 'closing' : 'open'}
      onKeyDown={trap}
      className="trainer-stage absolute inset-0 z-40 flex flex-col overflow-hidden bg-ink text-ink"
    >
      <div
        aria-hidden
        className="absolute inset-0 scale-110 bg-cover bg-center"
        style={{
          backgroundImage: `url(${JSON.stringify(resolveImageUrl(imageUrl))})`,
          filter: 'blur(14px)',
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: 'var(--flow-stage-overlay)' }}
      />
      {screen}
    </div>
  )
}

export default TrainerStage
