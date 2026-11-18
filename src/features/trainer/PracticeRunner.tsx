import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CircleHelp, Flag, X } from 'lucide-react'
import { Button } from '../../components/ui/Button.tsx'
import { announce } from '../../components/ui/announce.ts'
import { esTrainer } from '../../i18n/trainer.es.ts'
import { ReportForm } from '../assessment/ReportForm.tsx'
import { trainerApi } from './api.ts'
import { activityInfoOf, nextActivityId } from './activityInfo.ts'
import { classifyFailure } from './failure.ts'
import { useCatalog } from './useCatalog.ts'
import { StepView } from './StepViews.tsx'
import { Banner, TrainerCard } from './TrainerCard.tsx'
import { tokenDiff } from './tokenDiff.ts'
import { isAnswerable, type SessionState } from './sessionReducer.ts'
import { scaffoldingFor } from './levelConfig.ts'
import { useSession } from './useSession.ts'
import type { AnswerResult, SessionSummary, TrainerLevel } from './types.ts'

const text = esTrainer

const OUTCOME = {
  correct: { label: text.feedback.correct, Icon: Check, tone: 'bg-leaf-tint text-leaf-dark' },
  partial: { label: text.feedback.partial, Icon: CircleHelp, tone: 'bg-sun-tint text-sun-dark' },
  incorrect: { label: text.feedback.incorrect, Icon: X, tone: 'bg-danger-tint text-danger' },
  accepted: { label: text.feedback.accepted, Icon: Check, tone: 'bg-leaf-tint text-leaf-dark' },
} as const

// The answer, the authored explanation and the closest answer. For a written answer
// it also shows a local word comparison: what is missing and what is extra, not a grade.
const Feedback = ({
  result,
  written,
  activityId,
  stepId,
}: {
  result: AnswerResult
  written: string | null
  activityId: string
  stepId: string
}) => {
  const [reporting, setReporting] = useState(false)
  const { Icon, label, tone } = OUTCOME[result.outcome]
  const { explanation, closest_answer, error_tags } = result.feedback
  const diff = written !== null && closest_answer ? tokenDiff(written, closest_answer) : null
  return (
    <section aria-label={label} className="flex flex-col gap-3 rounded-md border-soft p-4">
      <p
        className={`inline-flex items-center gap-2 self-start rounded-pill px-3 py-1 text-sm font-extrabold ${tone}`}
      >
        <Icon size={16} strokeWidth={3} aria-hidden />
        {label}
      </p>
      {explanation && <p>{explanation}</p>}
      {closest_answer && (
        <p>
          <span className="block text-xs font-extrabold tracking-wide text-ink-soft uppercase">
            {text.feedback.closest}
          </span>
          <span className="font-semibold">{closest_answer}</span>
        </p>
      )}
      {diff && (
        <div>
          <p className="text-xs font-extrabold tracking-wide text-ink-soft uppercase">
            {text.feedback.compare}
          </p>
          <p className="text-sm text-ink-soft">{text.feedback.legend}</p>
          <p className="mt-1 leading-8">
            {diff.map((part, index) => (
              <span
                key={index}
                className={
                  part.kind === 'same'
                    ? ''
                    : part.kind === 'added'
                      ? 'rounded-sm bg-leaf-tint px-1 font-bold text-leaf-dark underline decoration-2'
                      : 'rounded-sm bg-danger-tint px-1 font-bold text-danger line-through'
                }
              >
                {/* Text as well as shape: the meaning never rests on color. */}
                {part.kind === 'added' && <span className="sr-only">{text.feedback.added}: </span>}
                {part.kind === 'removed' && (
                  <span className="sr-only">{text.feedback.removed}: </span>
                )}
                {part.text}{' '}
              </span>
            ))}
          </p>
        </div>
      )}
      {error_tags.length > 0 && (
        <ul className="list-disc pl-5 text-sm">
          {error_tags.map((tag) => (
            <li key={tag.tag}>{tag.text}</li>
          ))}
        </ul>
      )}
      {reporting ? (
        <ReportForm activityId={activityId} stepId={stepId} onClose={() => setReporting(false)} />
      ) : (
        <button
          type="button"
          className="inline-flex min-h-[44px] items-center gap-1 self-start text-sm font-bold text-primary underline underline-offset-4"
          onClick={() => setReporting(true)}
        >
          <Flag size={14} strokeWidth={2.5} aria-hidden />
          {text.feedback.report}
        </button>
      )}
    </section>
  )
}

const List = ({ title, items }: { title: string; items: string[] }) =>
  items.length === 0 ? null : (
    <section>
      <h3 className="text-sm font-extrabold">{title}</h3>
      <ul className="list-disc pl-5">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  )

// S8: what went well, at most three things to improve, new words, can-do.
const Summary = ({
  summary,
  savedIds,
  onSave,
}: {
  summary: SessionSummary
  savedIds: ReadonlySet<string>
  onSave: (wordId: string) => void
}) => {
  const copy = text.summary
  return (
    <>
      <p className="text-2xl font-extrabold">
        {copy.score(summary.score.correct, summary.score.total)}
      </p>
      <List title={copy.wentWell} items={summary.went_well} />
      {summary.to_improve.length > 0 && (
        <section>
          <h3 className="text-sm font-extrabold">{copy.toImprove}</h3>
          <ul className="list-disc pl-5">
            {summary.to_improve.slice(0, 3).map((entry) => (
              <li key={entry.tag}>
                {entry.text}
                {entry.example && (
                  <span className="block text-sm text-ink-soft">
                    {copy.example}: {entry.example}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {summary.new_vocabulary.length > 0 && (
        <section>
          <h3 className="text-sm font-extrabold">{copy.newWords}</h3>
          <ul className="flex flex-col gap-2">
            {summary.new_vocabulary.map((word) => (
              <li
                key={word.word_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border-hair p-2"
              >
                <span>
                  <span className="font-bold">{word.word}</span> · {word.translation}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={savedIds.has(word.word_id)}
                  onClick={() => onSave(word.word_id)}
                >
                  {savedIds.has(word.word_id) ? text.vocab.box(1) : text.feedback.saveWord}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <List title={copy.canDo} items={summary.can_do} />
      {summary.went_well.length === 0 && summary.to_improve.length === 0 && (
        <p className="text-ink-soft">{copy.nothing}</p>
      )}
    </>
  )
}

const failureText = (failure: SessionState['failure']) =>
  failure === 'unauthorized'
    ? text.errors.unauthorized
    : failure === 'closed'
      ? text.errors.closed
      : failure === 'contract'
        ? text.errors.contract
        : failure === 'unreachable'
          ? text.errors.unreachable
          : text.errors.other

export interface PracticeRunnerProps {
  activityId: string
  level?: TrainerLevel
  // Back to the lessons (or the home). "Volver al mapa" is the stage's own.
  onBack: () => void
  onNextActivity: (activityId: string) => void
  onChooseLesson: () => void
}

export const PracticeRunner = ({
  activityId,
  level,
  onBack,
  onNextActivity,
  onChooseLesson,
}: PracticeRunnerProps) => {
  // The backend has no route for one activity: the catalog (already loaded by the stage,
  // same query key) carries what the intro shows.
  const catalog = useCatalog()
  const info = activityInfoOf(catalog.data, activityId)
  // The catalog failed, or it loaded and does not list this activity (closed or gone).
  const infoFailure: SessionState['failure'] = catalog.isError
    ? classifyFailure(catalog.error)
    : catalog.isSuccess && !info
      ? 'closed'
      : null
  const { state, begin, setDraft, submit, next, finish, retry } = useSession(
    activityId,
    catalog.data?.preview === true
  )
  const [confirmExit, setConfirmExit] = useState(false)
  const [saved, setSaved] = useState<Set<string>>(new Set())
  const titleRef = useRef<HTMLHeadingElement>(null)
  const { phase, step } = state

  // Focus goes to the title when the screen changes (intro, summary, error).
  useEffect(() => {
    if (phase === 'idle' || phase === 'summary' || phase === 'error') titleRef.current?.focus()
  }, [phase])

  // Announce the outcome once, politely.
  useEffect(() => {
    if (phase === 'feedback' && state.result) announce(OUTCOME[state.result.outcome].label)
    if (phase === 'checking') announce(text.run.checking)
  }, [phase, state.result])

  const busy = phase === 'starting' || phase === 'checking' || phase === 'finishing'
  const inProgress = phase === 'step' || phase === 'checking' || phase === 'feedback'
  const last = state.result !== null && state.result.next_step === null
  const written =
    step &&
    state.draft &&
    'text' in state.draft &&
    (step.type === 'short_answer' || step.type === 'dialogue_turn')
      ? state.draft.text
      : null

  const save = (wordId: string) => {
    setSaved((current) => new Set(current).add(wordId))
    trainerApi.saveWord(wordId).catch(() => {
      setSaved((current) => {
        const copy = new Set(current)
        copy.delete(wordId)
        return copy
      })
    })
  }

  const title = phase === 'summary' ? text.summary.title : (info?.title ?? text.loading)
  const kicker =
    state.progress && inProgress
      ? text.run.step(state.progress.index, state.progress.total)
      : undefined

  const exit = (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {confirmExit ? (
        <span role="group" aria-label={text.run.exit} className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{text.run.exitConfirm}</span>
          <Button size="sm" variant="secondary" onClick={() => setConfirmExit(false)}>
            {text.run.exitStay}
          </Button>
          <Button size="sm" variant="ghost" onClick={onBack}>
            {text.run.exitLeave}
          </Button>
        </span>
      ) : (
        <Button variant="ghost" onClick={() => (inProgress ? setConfirmExit(true) : onBack())}>
          <ArrowLeft size={18} strokeWidth={3} aria-hidden />
          {inProgress ? text.run.exit : text.backToHome}
        </Button>
      )}
    </div>
  )

  let body: React.ReactNode = null
  let primary: React.ReactNode = null

  if (phase === 'idle') {
    body = info ? (
      <>
        {info.role && <p className="font-bold">{text.intro.role(info.role)}</p>}
        {info.can_do.length > 0 && (
          <section>
            <h3 className="text-sm font-extrabold">{text.intro.canDo}</h3>
            <ul className="list-disc pl-5">
              {info.can_do.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        )}
        <p className="text-sm text-ink-soft">{text.intro.steps(info.step_count)}</p>
      </>
    ) : infoFailure ? (
      <p role="alert" className="font-semibold text-danger">
        {infoFailure === 'closed' || infoFailure === 'contract'
          ? failureText(infoFailure)
          : text.errors.startFailed}
      </p>
    ) : (
      <p role="status">{text.loading}</p>
    )
    primary = (
      <Button onClick={begin} disabled={!info}>
        {text.intro.start}
        <ArrowRight size={18} strokeWidth={3} aria-hidden />
      </Button>
    )
  } else if (phase === 'starting') {
    body = <p role="status">{text.loading}</p>
  } else if (phase === 'error') {
    body = (
      <>
        <p role="alert" className="flex items-center gap-2 font-semibold text-danger">
          <AlertTriangle size={18} strokeWidth={2.5} aria-hidden />
          {failureText(state.failure)}
        </p>
        {state.failedAt === 'answer' && <p className="text-sm">{text.errors.keep}</p>}
        {step && state.failedAt === 'answer' && (
          <StepView step={step} draft={state.draft} disabled onDraft={setDraft} onSubmit={submit} />
        )}
      </>
    )
    primary =
      state.failure === 'unauthorized' ||
      state.failure === 'closed' ||
      state.failure === 'contract' ? null : (
        <Button onClick={retry}>{text.errors.retry}</Button>
      )
  } else if (phase === 'summary' && state.summary) {
    // The wire's summary has no can-do list or next activity: the catalog has both.
    const summary = {
      ...state.summary,
      can_do: info?.can_do ?? [],
      next_activity_id: nextActivityId(catalog.data, activityId),
    }
    body = <Summary summary={summary} savedIds={saved} onSave={save} />
    primary = (
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onChooseLesson}>
          {text.summary.again}
        </Button>
        {summary.next_activity_id && (
          <Button onClick={() => onNextActivity(summary.next_activity_id!)}>
            {text.summary.next}
            <ArrowRight size={18} strokeWidth={3} aria-hidden />
          </Button>
        )}
      </div>
    )
  } else if (step) {
    const locked = phase !== 'step'
    body = (
      <>
        <StepView
          step={step}
          draft={state.draft}
          disabled={locked}
          onDraft={setDraft}
          onSubmit={submit}
          level={level}
        />
        {step.hint &&
          step.type !== 'dialogue_turn' &&
          scaffoldingFor(level).hints &&
          phase === 'step' && (
            <details>
              <summary className="min-h-[44px] cursor-pointer font-bold text-primary">
                {text.run.showHint}
              </summary>
              <p>{step.hint}</p>
            </details>
          )}
        {phase === 'feedback' && state.result && (
          <Feedback
            result={state.result}
            written={written}
            activityId={activityId}
            stepId={step.step_id}
          />
        )}
      </>
    )
    primary =
      phase === 'feedback' ? (
        <Button onClick={last ? finish : next}>
          {last ? text.run.finish : text.run.next}
          <ArrowRight size={18} strokeWidth={3} aria-hidden />
        </Button>
      ) : phase === 'finishing' ? (
        <Button disabled>{text.run.finishing}</Button>
      ) : (
        <Button
          onClick={submit}
          disabled={phase === 'checking' || !isAnswerable(step, state.draft)}
          aria-live="polite"
        >
          {phase === 'checking' ? text.run.checking : text.run.check}
        </Button>
      )
  } else if (phase === 'finishing') {
    body = <p role="status">{text.run.finishing}</p>
  }

  return (
    <TrainerCard
      ref={titleRef}
      title={title}
      kicker={kicker}
      preview={state.preview}
      busy={busy}
      banner={
        phase === 'error' && state.failure === 'unauthorized' ? (
          <Banner tone="danger">{text.errors.unauthorized}</Banner>
        ) : undefined
      }
      footer={
        <>
          {exit}
          {primary}
        </>
      }
    >
      {body}
    </TrainerCard>
  )
}
