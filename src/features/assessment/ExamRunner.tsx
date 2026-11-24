import { ArrowLeft, ArrowRight, ClipboardCheck, Timer } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../components/ui/Button.tsx'
import { announce } from '../../components/ui/announce.ts'
import { useEmbed } from '../embed/EmbedContext.ts'
import { esAssessment } from '../../i18n/assessment.es.ts'
import {
  allSectionsLoaded,
  hasUnsaved,
  isFinished,
  numberedItems,
  screenKey,
  sectionLine,
  unansweredItems,
  type ExamState,
} from './examReducer.ts'
import { ExamResult } from './ExamResult.tsx'
import { ItemView, SharedBlock } from './ItemViews.tsx'
import { SimulationTools } from './SimulationTools.tsx'
import { simulateResult, simulationAllowed, type SimulatedOutcome } from './simulation.ts'
import { itemStatus } from './answers.ts'
import { formatClock } from './serverClock.ts'
import { useExam } from './useExam.ts'
import type {
  AssessmentListItem,
  AssessmentPolicy,
  AssessmentPurpose,
  AssessmentResult,
} from './types.ts'

const text = esAssessment

export interface ExamRunnerProps {
  purpose: AssessmentPurpose
  // What the list said about this assessment (counts, attempts, an attempt in progress).
  info: Pick<
    AssessmentListItem,
    'title' | 'section_count' | 'item_count' | 'attempts' | 'in_progress'
  >
  policy: AssessmentPolicy
  // The editing capability: it runs, nothing real happens.
  preview: boolean
  // The attempt was submitted or expired, whatever the result.
  onFinished?: (result: AssessmentResult) => void
  // "Volver al mapa" / closing the runner. Always available.
  onExit: () => void
  // Flow step only: leave without the exam, recorded as a fallback by the caller.
  onFallback?: () => void
  // Final exam: start the next attempt after a result.
  onAgain?: () => void
  // What the exit button says once there is a result ("Continuar" inside the flow).
  exitLabel?: string
  // Editor's test tools only (see simulation.ts): a simulation to show at once, and what "Ver
  // cierre" does after a simulated pass. Both are ignored unless the viewer is an editor in preview.
  initialSimulation?: SimulatedOutcome | null
  closingPreview?: 'none' | (() => void)
}

const Dots = ({ state, goto }: { state: ExamState; goto: (index: number) => void }) => (
  <ol aria-label={text.runner.progress} className="mt-2 flex items-center">
    {state.summaries.map((section, index) => {
      const kind =
        index === state.sectionIndex && state.view === 'section'
          ? 'current'
          : state.sections[index]
            ? 'visited'
            : 'pending'
      return (
        <li key={section.key} className="flex min-w-0 flex-1">
          <button
            type="button"
            className="flow-seg"
            data-kind={kind === 'pending' ? 'pending' : kind}
            aria-current={kind === 'current' ? 'step' : undefined}
            aria-label={text.runner.sectionDot(index + 1, section.title, kind)}
            onClick={() => goto(index)}
          >
            <span aria-hidden />
          </button>
        </li>
      )
    })}
  </ol>
)

const Banner = ({ children, tone }: { children: React.ReactNode; tone: 'sun' | 'danger' }) => (
  <p
    role={tone === 'danger' ? 'alert' : 'note'}
    className={`flex-none px-[var(--flow-pad)] py-2 text-sm font-semibold ${
      tone === 'danger' ? 'bg-danger-tint text-danger' : 'bg-sun-tint text-sun-dark'
    }`}
  >
    {children}
  </p>
)

export const ExamRunner = ({
  purpose,
  info,
  policy,
  preview,
  onFinished,
  onExit,
  onFallback,
  onAgain,
  exitLabel,
  initialSimulation = null,
  closingPreview,
}: ExamRunnerProps) => {
  const exam = useExam(purpose, onFinished)
  const { state } = exam
  // The test tools: a simulation draws a synthetic result and calls nothing (no attempt, no
  // save, no submit, no host message). The gate is the backend's preview plus the host's role.
  const embed = useEmbed()
  const canSimulate = simulationAllowed({ preview, editorRole: embed?.role === 'editor' })
  const [simulated, setSimulated] = useState<SimulatedOutcome | null>(
    canSimulate ? initialSimulation : null
  )
  // Winning the check-in in a simulation plays what a student's win would: the closing
  // flow opens at once (the "Ver cierre" button on the result opens it again).
  const playClosingOnWin = (outcome: SimulatedOutcome) => {
    if (purpose !== 'check_in' || typeof closingPreview !== 'function') return
    if (simulateResult(outcome, policy, info.attempts).passed) closingPreview()
  }
  const simulate = (outcome: SimulatedOutcome) => {
    if (!canSimulate || state.phase !== 'idle') return
    setSimulated(outcome)
    announce(text.simulation.announce[outcome])
    playClosingOnWin(outcome)
  }
  // A simulation the exam opens with (from the editor's flow preview) counts the same.
  const initialPlayed = useRef(false)
  useEffect(() => {
    if (initialPlayed.current) return
    initialPlayed.current = true
    if (canSimulate && initialSimulation) playClosingOnWin(initialSimulation)
    // Once, on opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const simulatedResult = useMemo(
    () => (canSimulate && simulated ? simulateResult(simulated, policy, info.attempts) : null),
    [canSimulate, simulated, policy, info.attempts]
  )
  const headingRef = useRef<HTMLHeadingElement>(null)
  const title = info.title || text.titles[purpose]
  const left = Math.max(0, info.attempts.max - info.attempts.used)
  const live = state.phase === 'running' || state.phase === 'saving'
  const submitting = state.phase === 'submitting'
  const numbered = useMemo(() => numberedItems(state), [state])
  const unanswered = useMemo(() => unansweredItems(state), [state])

  // Focus goes to the title of whatever is on screen when it changes (not when it only saves).
  const screen = screenKey(state)
  useEffect(() => {
    headingRef.current?.focus()
  }, [screen])

  // The review lists unanswered items by number, so it needs every section.
  const reviewReady = allSectionsLoaded(state)

  const section = state.sections[state.sectionIndex]
  const line = sectionLine(state)
  const lastSection = state.sectionIndex >= state.summaries.length - 1

  const resume = info.in_progress !== null

  // ---- what the footer's primary action is
  const primary = (() => {
    if (simulatedResult)
      return (
        <Button variant="secondary" onClick={onExit}>
          {text.result.toMap}
        </Button>
      )
    if (state.phase === 'idle')
      return (
        <Button variant="secondary" onClick={() => exam.start(resume)}>
          {resume ? text.intro.resume : text.intro.start}
          <ArrowRight size={18} strokeWidth={3} aria-hidden />
        </Button>
      )
    if (isFinished(state.phase))
      return (
        <Button variant="secondary" onClick={onExit}>
          {exitLabel ?? text.result.toMap}
        </Button>
      )
    // The gate is closed: retrying cannot help. Back to the step, which looks again.
    if (state.phase === 'error' && state.error?.kind === 'closing_not_available')
      return (
        <Button variant="secondary" onClick={onExit}>
          {text.errors.back}
        </Button>
      )
    if (state.phase === 'error')
      return (
        <Button variant="secondary" onClick={exam.retry}>
          {text.errors.retry}
        </Button>
      )
    if (live && state.view === 'section')
      return lastSection ? (
        <Button variant="secondary" onClick={exam.openReview}>
          <ClipboardCheck size={18} strokeWidth={3} aria-hidden />
          {text.runner.review}
        </Button>
      ) : (
        <Button variant="secondary" onClick={() => exam.gotoSection(state.sectionIndex + 1)}>
          {text.runner.next}
          <ArrowRight size={18} strokeWidth={3} aria-hidden />
        </Button>
      )
    return null
  })()

  const tools =
    canSimulate && state.phase === 'idle' ? (
      <SimulationTools policy={policy} active={simulated} onSimulate={simulate} />
    ) : null

  const body = (() => {
    if (simulatedResult && simulated)
      return (
        <div className="flow-pad flex flex-col gap-5">
          <ExamResult
            purpose={purpose}
            result={simulatedResult}
            preview
            policy={policy}
            simulated={{ outcome: simulated, closing: closingPreview }}
          />
          {tools}
        </div>
      )
    if (state.phase === 'idle')
      return (
        <div className="flow-pad flex flex-col gap-4">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="flow-title font-heading font-extrabold outline-none"
          >
            {title}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {[
              text.intro.questions(info.item_count),
              text.intro.sections(info.section_count),
              text.intro.minutes(policy.time_limit_min),
              text.intro.attemptsLeft(left),
            ].map((chip) => (
              <li
                key={chip}
                className="border-hair rounded-md bg-surface-muted px-3 py-1 text-sm font-bold"
              >
                {chip}
              </li>
            ))}
          </ul>
          <p className="flow-prose font-semibold">{text.intro.timeRuns}</p>
          <p className="flow-prose">{text.intro.autosave}</p>
          <p className="flow-prose">{text.intro.speaking}</p>
          {tools}
        </div>
      )
    if (state.phase === 'starting' || state.phase === 'resuming')
      return (
        <div className="flow-pad flex flex-col gap-3">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="flow-title font-heading font-extrabold outline-none"
          >
            {title}
          </h2>
          <p role="status" className="flow-prose">
            {text.intro.starting}
          </p>
        </div>
      )
    if (state.phase === 'error' && state.error)
      return (
        <div className="flow-pad flex flex-col gap-3">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="flow-title font-heading font-extrabold outline-none"
          >
            {title}
          </h2>
          <p role="alert" className="flow-prose font-semibold">
            {state.error.retry === 'submit'
              ? text.errors.submitFailed
              : text.errors[state.error.kind]}
          </p>
          {state.attemptId && <p className="flow-prose">{text.errors.keepsAnswers}</p>}
          {onFallback && state.error.kind !== 'closing_not_available' && (
            <div className="flex flex-col items-start gap-1">
              <Button variant="surface" dense onClick={onFallback}>
                {text.step.skip}
              </Button>
              <p className="text-sm text-ink-soft">{text.step.skipNote}</p>
            </div>
          )}
        </div>
      )
    if (isFinished(state.phase) && state.result)
      return (
        <div className="flow-pad">
          <ExamResult
            purpose={purpose}
            result={state.result}
            preview={preview}
            policy={policy}
            onAgain={onAgain}
          />
        </div>
      )
    if (state.view === 'review')
      return <Review state={state} exam={exam} unanswered={unanswered} ready={reviewReady} />
    // The sections.
    return (
      <div className="flow-pad flex flex-col gap-6">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="flow-title font-heading font-extrabold outline-none"
        >
          {text.runner.sectionLine(line.index, line.total, line.title)}
        </h2>
        {state.sectionError === state.sectionIndex ? (
          <div role="alert" className="flex flex-col items-start gap-2">
            <p className="font-semibold">{text.runner.sectionError}</p>
            <Button variant="surface" dense onClick={exam.retrySection}>
              {text.runner.sectionRetry}
            </Button>
          </div>
        ) : !section ? (
          <p role="status">{text.runner.sectionLoading}</p>
        ) : (
          section.parts.map((part) => (
            <div key={part.part_key} className="flex flex-col gap-4">
              {part.instructions && <p className="flow-prose font-semibold">{part.instructions}</p>}
              {part.shared && <SharedBlock shared={part.shared} />}
              <ol className="flex flex-col gap-6">
                {part.items.map((item) => {
                  const entry = numbered.find((n) => n.item.item_id === item.item_id)
                  return (
                    <li key={item.item_id} className="rounded-lg border-soft bg-surface p-4">
                      <ItemView
                        item={item}
                        number={entry?.number ?? 0}
                        response={state.answers[item.item_id]}
                        onChange={(response) => exam.answer(item.item_id, response)}
                      />
                    </li>
                  )
                })}
              </ol>
            </div>
          ))
        )}
      </div>
    )
  })()

  return (
    <div className="flow-stage relative">
      <div
        className="flow-card"
        data-wide="true"
        role="group"
        aria-label={title}
        aria-busy={submitting || state.phase === 'starting'}
      >
        <header className="flow-card-head">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <p className="text-sm font-bold">
              {live || submitting
                ? text.runner.sectionLine(line.index, line.total, line.title)
                : title}
            </p>
            <div className="flex items-center gap-3 text-sm font-bold">
              {(live || submitting) && state.remainingMs !== null && (
                <span
                  role="timer"
                  aria-live="off"
                  aria-label={text.runner.timeLeftAria(formatClock(state.remainingMs))}
                  className="inline-flex items-center gap-1 rounded-md border-hair bg-surface px-2 py-0.5 text-ink"
                >
                  <Timer size={16} strokeWidth={2.5} aria-hidden />
                  <span aria-hidden>{formatClock(state.remainingMs)}</span>
                </span>
              )}
              {live && <SaveStatus state={state} retry={exam.retrySave} />}
            </div>
          </div>
          {(live || submitting) && state.summaries.length > 0 && (
            <Dots state={state} goto={exam.gotoSection} />
          )}
        </header>

        {preview && (
          <Banner tone="sun">{purpose === 'final' ? text.previewFinal : text.preview}</Banner>
        )}
        {live && state.error?.kind === 'unauthorized' && (
          <Banner tone="danger">{text.errors.unauthorized}</Banner>
        )}
        {submitting && <Banner tone="sun">{text.review.submitting}</Banner>}

        <div className="flow-card-scroll">{body}</div>

        <footer className="flow-card-foot justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {live && state.view === 'section' && state.sectionIndex > 0 ? (
              <Button variant="ghost" onClick={() => exam.gotoSection(state.sectionIndex - 1)}>
                <ArrowLeft size={18} strokeWidth={3} aria-hidden />
                {text.runner.previous}
              </Button>
            ) : live && state.view === 'review' ? (
              <Button variant="ghost" onClick={exam.closeReview}>
                <ArrowLeft size={18} strokeWidth={3} aria-hidden />
                {text.review.back}
              </Button>
            ) : (
              <Button variant="ghost" onClick={onExit}>
                {text.close}
              </Button>
            )}
            {live && state.view === 'section' && !lastSection && (
              <Button variant="surface" dense onClick={exam.openReview}>
                {text.runner.review}
              </Button>
            )}
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{primary}</div>
        </footer>
      </div>
    </div>
  )
}

const SaveStatus = ({ state, retry }: { state: ExamState; retry: () => void }) => {
  if (state.saveStatus === 'failed')
    return (
      <span role="alert" className="flex items-center gap-2 text-danger">
        <span>{text.runner.saveFailed}</span>
        <Button variant="surface" dense size="sm" onClick={retry}>
          {text.runner.saveRetry}
        </Button>
      </span>
    )
  // Quiet by design: no live region, so a save every few seconds is never read aloud.
  if (state.phase === 'saving' || hasUnsaved(state)) return <span>{text.runner.saving}</span>
  if (state.saveStatus === 'saved') return <span>✓ {text.runner.saved}</span>
  return null
}

const Review = ({
  state,
  exam,
  unanswered,
  ready,
}: {
  state: ExamState
  exam: ReturnType<typeof useExam>
  unanswered: ReturnType<typeof unansweredItems>
  ready: boolean
}) => {
  const [confirming, setConfirming] = useState(false)
  return (
    <div className="flow-pad flex flex-col gap-4">
      <h2 tabIndex={-1} className="flow-title font-heading font-extrabold outline-none">
        {text.review.title}
      </h2>
      {!ready ? (
        <p role="status">{text.review.loading}</p>
      ) : unanswered.length === 0 ? (
        <p className="flow-prose font-semibold">{text.review.allDone}</p>
      ) : (
        <>
          <p className="flow-prose font-semibold">{text.review.unanswered(unanswered.length)}</p>
          <ul className="flex flex-col gap-2">
            {unanswered.map((entry) => (
              <li
                key={entry.item.item_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border-soft bg-surface px-3 py-2"
              >
                <span className="font-semibold">
                  {text.review.item(entry.number, state.summaries[entry.sectionIndex]?.title ?? '')}
                  <span className="ml-2 text-sm font-bold text-ink-soft">
                    {itemStatus(entry.item, state.answers[entry.item.item_id]) === 'partial'
                      ? text.review.partial
                      : text.review.empty}
                  </span>
                </span>
                <Button
                  variant="surface"
                  dense
                  size="sm"
                  aria-label={text.review.go(entry.number)}
                  onClick={() => exam.gotoSection(entry.sectionIndex)}
                >
                  {text.review.goShort}
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
      {confirming ? (
        <div
          role="group"
          aria-label={text.review.confirmTitle}
          className="flex flex-col gap-3 rounded-lg border-strong bg-sun-tint p-4"
        >
          <h3 className="text-lg font-extrabold">{text.review.confirmTitle}</h3>
          <p className="font-semibold">
            {ready ? text.review.confirmBody(unanswered.length) : text.review.confirmBodyUnknown}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={exam.submit}>
              {text.review.confirm}
            </Button>
            <Button variant="surface" onClick={() => setConfirming(false)}>
              {text.review.keep}
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Button variant="secondary" onClick={() => setConfirming(true)}>
            {text.review.submit}
          </Button>
        </div>
      )}
    </div>
  )
}
