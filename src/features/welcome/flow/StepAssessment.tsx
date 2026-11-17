import { Clock, Info } from 'lucide-react'
import { useCallback, useEffect, useState, type Dispatch } from 'react'
import { Button } from '../../../components/ui/Button.tsx'
import { esAssessment } from '../../../i18n/assessment.es.ts'
import { assessmentApi } from '../../assessment/api.ts'
import { classifyFailure } from '../../assessment/failure.ts'
import { formatClock } from '../../assessment/serverClock.ts'
import type { AssessmentList, AssessmentListItem } from '../../assessment/types.ts'
import type { WelcomeAssessmentStep } from '../../course-map/data/types.ts'
import type { FlowEvent, FlowState } from './flowReducer.ts'

const text = esAssessment.step

// Waits before the second and third look at the list, so a blip does not show an
// error; after those the step offers "Reintentar" and "Continuar de todos modos".
const LIST_RETRY_DELAYS_MS = [1_000, 3_000] as const

export type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; list: AssessmentList; item: AssessmentListItem }
  | { kind: 'unreachable' }

export interface Launch {
  info: AssessmentListItem
  policy: AssessmentList['policy']
  preview: boolean
}

// The check-in step. It reads GET /assessments, says the state in words, and
// launches the runner inside the flow's own stage. It never traps: a disabled or
// locked check-in does not block, a finished or used one counts as done, and an
// unreachable backend offers the retry and the recorded way out.
export const StepAssessment = ({
  step,
  state,
  dispatch,
  onLaunch,
}: {
  step: WelcomeAssessmentStep
  state: FlowState
  dispatch: Dispatch<FlowEvent>
  onLaunch: (launch: Launch) => void
}) => {
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)
  // The device time when the list arrived: the countdown here is only a hint (the
  // runner counts from the server's clock).
  const [loadedAt, setLoadedAt] = useState(0)
  const outcome = state.assessment[step.key]

  useEffect(() => {
    let cancelled = false
    const look = (n: number) => {
      assessmentApi
        .list()
        .then((list) => {
          if (cancelled) return
          const item = list.items.find((entry) => entry.purpose === step.purpose)
          // Not enabled for this map, or no such assessment: it does not block.
          if (!list.enabled || !item) return dispatch({ type: 'unavailable' })
          setLoadedAt(Date.now())
          setLoad({ kind: 'ready', list, item })
        })
        .catch((error: unknown) => {
          if (cancelled) return
          // 404 is "feature disabled for this map" (contract); not a failure.
          const status = (error as { status?: number }).status
          if (status === 404) return dispatch({ type: 'unavailable' })
          if (classifyFailure(error) === 'unauthorized' || n >= LIST_RETRY_DELAYS_MS.length)
            return setLoad({ kind: 'unreachable' })
          setTimeout(() => !cancelled && look(n + 1), LIST_RETRY_DELAYS_MS[n])
        })
    }
    look(0)
    return () => {
      cancelled = true
    }
    // `attempt` is the retry button.
  }, [step.purpose, attempt, dispatch])

  const item = load.kind === 'ready' ? load.item : null
  // A check-in already taken (used up or passed before the flow asked again) is
  // done: that is true, and recording it is not a guess. A locked one does not block.
  useEffect(() => {
    if (!item || outcome) return
    if (item.state === 'exhausted' || item.state === 'passed') dispatch({ type: 'assessment-done' })
    else if (item.state === 'locked') dispatch({ type: 'unavailable' })
  }, [item, outcome, dispatch])

  const retry = useCallback(() => {
    setLoad({ kind: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  if (load.kind === 'unreachable')
    return (
      <div className="flow-pad flex flex-col gap-3">
        <p role="alert" className="flow-prose font-semibold">
          {text.unreachable}
        </p>
        <p className="flow-prose">{text.unreachableHelp}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" dense onClick={retry}>
            {text.retry}
          </Button>
          <Button variant="surface" dense onClick={() => dispatch({ type: 'assessment-escape' })}>
            {text.skip}
          </Button>
        </div>
        <p className="flex items-start gap-2 text-sm text-ink-soft">
          <Info size={16} strokeWidth={2.5} aria-hidden className="mt-0.5 flex-none" />
          {text.skipNote}
        </p>
      </div>
    )

  if (load.kind === 'loading')
    return (
      <div className="flow-pad">
        <p role="status" className="flow-prose">
          {text.checking}
        </p>
      </div>
    )

  const { list } = load
  const done = outcome !== undefined || item?.state === 'exhausted' || item?.state === 'passed'
  const inProgress = item?.in_progress ?? null
  const remainingMs = inProgress ? Date.parse(inProgress.deadline_at) - loadedAt : null
  return (
    <div className="flow-pad flex flex-col gap-3">
      {state.editor && (
        <p
          role="note"
          className="rounded-md bg-sun-tint px-3 py-2 text-sm font-semibold text-sun-dark"
        >
          {text.editorNote}
        </p>
      )}
      {done ? (
        <p role="status" className="flow-prose font-semibold">
          {outcome === 'fallback' ? text.skipNote : text.done}
        </p>
      ) : item?.state === 'locked' ? (
        <p role="status" className="flow-prose">
          {item.locked_reason ?? text.locked}
        </p>
      ) : (
        <>
          <p className="flow-prose">
            {inProgress && remainingMs !== null && remainingMs > 0
              ? text.inProgress(formatClock(remainingMs))
              : text.available}
          </p>
          {inProgress && (
            <p className="flex items-center gap-2 text-sm font-bold text-ink-soft">
              <Clock size={16} strokeWidth={2.5} aria-hidden />
              {esAssessment.intro.timeRuns}
            </p>
          )}
          {item && (
            <div>
              <Button
                variant="secondary"
                onClick={() => onLaunch({ info: item, policy: list.policy, preview: list.preview })}
              >
                {inProgress ? text.resume : text.open}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
