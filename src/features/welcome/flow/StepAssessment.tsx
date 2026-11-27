import { Clock, Info, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState, type Dispatch } from 'react'
import { Button } from '../../../components/ui/Button.tsx'
import { esAssessment } from '../../../i18n/assessment.es.ts'
import { assessmentApi } from '../../assessment/api.ts'
import { finalOfferOf } from '../../assessment/finalOffer.ts'
import { closingApi } from '../../assessment/useClosingStatus.ts'
import { classifyFailure } from '../../assessment/failure.ts'
import {
  reasonOfLockedCode,
  reasonText,
  type UnavailableReason,
} from '../../assessment/lockedReason.ts'
import { formatClock } from '../../assessment/serverClock.ts'

import type { AssessmentListItem, EnabledAssessmentList } from '../../assessment/types.ts'
import type { WelcomeAssessmentStep } from '../../course-map/data/types.ts'
import type { FlowEvent, FlowState } from './flowReducer.ts'

const checkInText = esAssessment.step

// Waits before the second and third look at the list, so a blip does not show an
// error; after those the step offers "Reintentar" and "Continuar de todos modos".
const LIST_RETRY_DELAYS_MS = [1_000, 3_000] as const

export type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; list: EnabledAssessmentList; item: AssessmentListItem }
  // The exam cannot be offered (draft, disabled, no form): a reason in words and the
  // recorded way out.
  | { kind: 'unavailable'; reason: UnavailableReason }
  // Already passed (this exam or the other one): done, and "Terminar" is open.
  | { kind: 'passed' }
  | { kind: 'unreachable' }

export interface Launch {
  info: AssessmentListItem
  policy: EnabledAssessmentList['policy']
  preview: boolean
}

// The check-in step. It reads GET /assessments, says the state in words, and
// launches the runner inside the flow's own stage. "Terminar" opens only when the
// attempt was submitted (whatever the result), when the viewer already passed, or
// through the recorded escape that an exam which cannot be offered shows. A failed
// load keeps it closed and offers "Reintentar".
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
  // The closing flow's final exam uses the same states with its own names.
  const text =
    step.purpose === 'final' ? { ...checkInText, ...esAssessment.stepFinal } : checkInText
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)
  // The device time when the list arrived: the countdown here is only a hint (the
  // runner counts from the server's clock).
  const [loadedAt, setLoadedAt] = useState(0)
  const outcome = state.assessment[step.key]

  useEffect(() => {
    let cancelled = false
    // While the backend's closing gate is on, the final is not in the list: the closing
    // status carries it, and says what the student may do with it.
    const read = async () => {
      const list = await assessmentApi.list()
      const listed = list.enabled && list.items.some((entry) => entry.purpose === step.purpose)
      if (step.purpose !== 'final' || !list.enabled || listed) return { list, offer: null }
      return { list, offer: finalOfferOf(await closingApi.status()) }
    }
    const look = (n: number) => {
      read()
        .then(({ list, offer }) => {
          if (cancelled) return
          if (!list.enabled) return setLoad({ kind: 'unavailable', reason: 'disabled' })
          if (offer) {
            if (offer.kind !== 'ready') return setLoad(offer)
            setLoadedAt(Date.now())
            return setLoad({ kind: 'ready', list, item: offer.item })
          }
          // A pass in either exam is a pass: nothing is left to ask of the student.
          if (list.items.some((entry) => entry.state === 'passed'))
            return setLoad({ kind: 'passed' })
          const item = list.items.find((entry) => entry.purpose === step.purpose)
          if (!item) return setLoad({ kind: 'unavailable', reason: 'no_form' })
          if (item.state === 'locked')
            return setLoad({ kind: 'unavailable', reason: reasonOfLockedCode(item.locked_reason) })
          setLoadedAt(Date.now())
          setLoad({ kind: 'ready', list, item })
        })
        .catch((error: unknown) => {
          if (cancelled) return
          // 404 is "feature disabled for this map" (contract); not a failure.
          const status = (error as { status?: number }).status
          if (status === 404) return setLoad({ kind: 'unavailable', reason: 'disabled' })
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
  }, [step.purpose, attempt])

  const item = load.kind === 'ready' ? load.item : null
  // An exam already taken (attempts used up, or passed before the flow asked again)
  // is done: that is true, and recording it is not a guess.
  const alreadyDone = load.kind === 'passed' || item?.state === 'exhausted'
  useEffect(() => {
    if (alreadyDone && !outcome) dispatch({ type: 'assessment-done' })
  }, [alreadyDone, outcome, dispatch])

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
        <div>
          <Button variant="secondary" dense onClick={retry}>
            {text.retry}
          </Button>
        </div>
      </div>
    )

  if (load.kind === 'loading')
    return (
      <div className="flow-pad" aria-busy="true">
        <p role="status" className="flow-prose flex items-center gap-2">
          <Loader2 size={18} strokeWidth={2.5} aria-hidden className="animate-spin" />
          {text.checking}
        </p>
      </div>
    )

  if (load.kind === 'passed')
    return (
      <div className="flow-pad">
        <p role="status" className="flow-prose font-semibold">
          {text.passed}
        </p>
        <p className="flow-prose">{text.passedNote}</p>
      </div>
    )

  if (load.kind === 'unavailable')
    return (
      <div className="flow-pad flex flex-col gap-3">
        {outcome === 'fallback' ? (
          <p role="status" className="flow-prose">
            {text.skipNote}
          </p>
        ) : (
          <>
            <p role="status" className="flow-prose font-semibold">
              {reasonText(load.reason, step.purpose)}
            </p>
            {state.editor && (
              <p
                role="note"
                className="rounded-md bg-sun-tint px-3 py-2 text-sm font-semibold text-sun-dark"
              >
                {text.editorNote}
              </p>
            )}
            <div>
              <Button
                variant="surface"
                dense
                onClick={() => dispatch({ type: 'assessment-escape' })}
              >
                {text.skip}
              </Button>
            </div>
            <p className="flex items-start gap-2 text-sm text-ink-soft">
              <Info size={16} strokeWidth={2.5} aria-hidden className="mt-0.5 flex-none" />
              {text.skipNote}
            </p>
          </>
        )}
      </div>
    )

  const { list } = load
  const done = outcome !== undefined || item?.state === 'exhausted'
  const inProgress = item?.in_progress ?? null
  const remainingMs = inProgress ? Date.parse(inProgress.deadline_at) - loadedAt : null
  return (
    <div className="flow-pad flex flex-col gap-3">
      {(state.editor || list.preview) && (
        <p
          role="note"
          className="rounded-md bg-sun-tint px-3 py-2 text-sm font-semibold text-sun-dark"
        >
          {step.purpose === 'final' ? esAssessment.previewFinal : text.editorNote}
          {step.purpose === 'final' && state.editor && ` ${text.editorNote}`}
        </p>
      )}
      {done ? (
        <p role="status" className="flow-prose font-semibold">
          {outcome === 'fallback'
            ? text.skipNote
            : item?.state === 'exhausted'
              ? text.exhausted
              : text.done}
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
