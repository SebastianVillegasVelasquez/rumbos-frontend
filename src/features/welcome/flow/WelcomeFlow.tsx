import { useCallback, useEffect, useId, useReducer, useRef, type KeyboardEvent } from 'react'
import { ArrowLeft, ArrowRight, Maximize2 } from 'lucide-react'
import { Button } from '../../../components/ui/Button.tsx'
import { useDataSaver } from '../../../fx/dataSaverStore.ts'
import { es } from '../../../i18n/es.ts'
import { resolveImageUrl } from '../../course-map/data/assets.ts'
import type { WelcomeDocument, WelcomeStep } from '../../course-map/data/types.ts'
import { CurtainMusicSwitch } from '../CurtainMusicSwitch.tsx'
import { useCurtainMusic } from '../useCurtainMusic.ts'
import { PLACEHOLDER } from '../welcome.ts'
import {
  createFlowState,
  flowReducer,
  gateOf,
  newCompletions,
  toStepInfo,
  isDone,
  type FlowMode,
  type ProgressEntry,
} from './flowReducer.ts'
import type { FlowPersistence } from './flowPersistence.ts'
import { StepHtml, StepPdf, StepQuiz, StepVideo, StepWelcome } from './FlowSteps.tsx'
import { waitingText } from './waitingText.ts'

const text = es.flow

export interface WelcomeFlowProps {
  steps: WelcomeStep[]
  mode: FlowMode
  entries: ProgressEntry[]
  persistence: FlowPersistence | null
  documents: WelcomeDocument[]
  // The course name for the {curso} placeholder in step titles.
  courseName: string
  imageUrl: string
  hasMusic: boolean
  track?: { title: string; coverUrl: string | null; startAfterInteraction: boolean } | null
  // Enters fullscreen; null while there is nothing to offer.
  onEnterFullscreen?: (() => void) | null
  // The flow is over (completed, or a review or a preview closed), with what is done.
  onFinish: (done: ProgressEntry[]) => void
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])'

// The welcome flow: a full-screen dialog over the map with the step indicator,
// the content of the current step (which scrolls inside itself), "Atrás" and
// "Continuar". The player only renders: what each step needs and what counts as
// done is the pure reducer (flowReducer.ts). No swipe to advance, it would
// bypass the gating.
const WelcomeFlow = ({
  steps,
  mode,
  entries,
  persistence,
  documents,
  courseName,
  imageUrl,
  hasMusic,
  track = null,
  onEnterFullscreen = null,
  onFinish,
}: WelcomeFlowProps) => {
  const dataSaver = useDataSaver().active
  const [state, dispatch] = useReducer(flowReducer, undefined, () =>
    createFlowState(steps.map(toStepInfo), entries, mode)
  )
  const rootRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const viewRef = useRef<HTMLDivElement>(null)
  const columnRef = useRef<HTMLDivElement>(null)
  const noteId = useId()

  const music = useCurtainMusic({
    enabled: hasMusic && mode !== 'preview',
    startAfterInteraction: track?.startAfterInteraction ?? false,
  })
  const beganRef = useRef(false)
  const beginMusic = useCallback(() => {
    // The first primary button is the gesture that starts the music.
    if (beganRef.current) return
    beganRef.current = true
    music.begin()
  }, [music])
  const hold = music.hold

  const step = steps[state.index]
  const gate = gateOf(state)
  const total = steps.length
  const title = step.title.split(PLACEHOLDER).join(courseName)

  // What the transition made newly done goes to the persistence (never in review
  // or preview: newCompletions is empty there).
  const previous = useRef(state)
  useEffect(() => {
    const completions = newCompletions(previous.current, state)
    previous.current = state
    if (completions.length > 0) persistence?.record(completions)
  }, [state, persistence])

  useEffect(() => {
    if (!state.finished) return
    onFinish(
      Object.entries(state.done).map(([stepKey, { revision, method }]) => ({
        stepKey,
        revision,
        method,
      }))
    )
  }, [state.finished, state.done, onFinish])

  // Focus the heading on each step, and announce it.
  useEffect(() => {
    headingRef.current?.focus()
  }, [state.index])

  // Visible seconds of the step (tab visible only), for the timed steps.
  const timed = step.type === 'html' || step.type === 'pdf'
  useEffect(() => {
    if (!timed) return
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') dispatch({ type: 'tick' })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [timed, state.index])

  const trapFocus = (event: KeyboardEvent) => {
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

  const isLast = state.index === total - 1
  const note = waitingText(state)
  const blocked = !gate.canContinue
  const goNext = () => {
    if (blocked) return
    beginMusic()
    dispatch({ type: 'next' })
  }
  const skipVisible = mode === 'preview'

  const body = (() => {
    switch (step.type) {
      case 'welcome':
        return (
          <StepWelcome
            message={step.message}
            extra={
              hasMusic && state.index === 0 ? (
                <CurtainMusicSwitch
                  on={music.on}
                  disabled={mode === 'preview'}
                  track={track}
                  dataSaver={dataSaver}
                  onToggle={music.toggle}
                />
              ) : null
            }
          />
        )
      case 'video':
        return (
          <StepVideo
            key={step.key}
            step={step}
            state={state}
            dispatch={dispatch}
            viewRef={viewRef}
            columnRef={columnRef}
            onStart={beginMusic}
            onHold={hold}
          />
        )
      case 'html':
        return <StepHtml key={step.key} step={step} state={state} dispatch={dispatch} />
      case 'pdf':
        return (
          <StepPdf
            key={step.key}
            step={step}
            document={documents.find((item) => item.assetId === step.assetId) ?? null}
            state={state}
            dispatch={dispatch}
          />
        )
      case 'quiz':
        return <StepQuiz key={step.key} step={step} state={state} dispatch={dispatch} />
    }
  })()

  const nextLabel = (() => {
    if (step.type === 'welcome' && step.buttonLabel?.trim()) return step.buttonLabel.trim()
    if (step.type === 'welcome' && state.index === 0) return es.welcome.start
    return isLast ? text.finish : text.next
  })()

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={text.dialog}
      onKeyDown={trapFocus}
      className="absolute inset-0 z-50 overflow-hidden bg-ink text-white"
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
        style={{ background: 'var(--welcome-scrim)' }}
      />

      <div
        className="relative mx-auto flex h-full w-full max-w-3xl flex-col gap-3 px-3 py-3"
        style={{
          paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))',
          paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))',
        }}
      >
        {/* The top-right 64x64 corner stays empty: the host puts its exit there. */}
        <header
          className="flex flex-wrap items-center gap-x-3 gap-y-2"
          style={{ paddingRight: 64 }}
        >
          <p className="text-sm font-bold">{text.stepOf(state.index + 1, total)}</p>
          <ol aria-label={text.progress} className="flex flex-wrap items-center gap-1.5">
            {steps.map((item, index) => {
              const reachable = state.mode === 'review' || index <= state.furthest
              const done = isDone(state, state.steps[index])
              const kind = done ? 'done' : reachable ? 'current' : 'locked'
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    disabled={!reachable}
                    aria-current={index === state.index ? 'step' : undefined}
                    aria-label={text.dot(index + 1, item.title, kind)}
                    onClick={() => dispatch({ type: 'goto', index })}
                    className="flex h-6 min-w-6 items-center justify-center rounded-pill border-2 border-white px-1 text-xs font-bold disabled:opacity-60"
                    style={{
                      background: kind === 'current' ? '#fff' : 'transparent',
                      color: kind === 'current' ? 'var(--color-ink, #1b1b1f)' : '#fff',
                    }}
                  >
                    {/* The number and the state are text: never color alone. */}
                    {done ? '✓' : index + 1}
                  </button>
                </li>
              )
            })}
          </ol>
          <div className="ml-auto flex items-center gap-2">
            {onEnterFullscreen && (
              <Button variant="surface" size="sm" dense onClick={onEnterFullscreen}>
                <Maximize2 size={16} strokeWidth={2.5} aria-hidden />
                {es.welcome.fullscreen}
              </Button>
            )}
            {(mode === 'review' || skipVisible) && (
              <Button variant="surface" size="sm" dense onClick={() => dispatch({ type: 'close' })}>
                {mode === 'review' ? text.close : text.skipPreview}
              </Button>
            )}
          </div>
        </header>

        {mode !== 'normal' && (
          <p role="note" className="text-xs font-semibold">
            {mode === 'review' ? text.review : text.preview}
          </p>
        )}

        <section
          ref={viewRef}
          className="border-soft flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain rounded-lg bg-surface p-4 text-ink"
        >
          <div
            ref={columnRef}
            key={step.key}
            className={`flex min-h-0 flex-1 flex-col gap-4 ${dataSaver ? '' : 'flow-step-in'}`}
          >
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="font-heading text-2xl font-extrabold break-words outline-none"
            >
              {title}
              {!step.mandatory && (
                <span className="ml-2 align-middle text-sm font-bold text-ink-soft">
                  ({text.optionalTag})
                </span>
              )}
            </h1>
            {body}
          </div>
        </section>

        <footer className="flex flex-col gap-2">
          {note && (
            <p id={noteId} className="text-sm font-semibold">
              {note}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="surface"
              onClick={() => dispatch({ type: 'back' })}
              disabled={state.index === 0}
            >
              <ArrowLeft size={18} strokeWidth={3} aria-hidden />
              {text.back}
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              {gate.canSkip && (
                <Button variant="surface" onClick={() => dispatch({ type: 'skip' })}>
                  {text.skip}
                </Button>
              )}
              {/* aria-disabled, not disabled: it stays focusable and its note is read. */}
              <Button
                variant="secondary"
                aria-disabled={blocked}
                aria-describedby={blocked && note ? noteId : undefined}
                className={blocked ? 'opacity-60' : ''}
                onClick={goNext}
              >
                {nextLabel}
                {!isLast && <ArrowRight size={18} strokeWidth={3} aria-hidden />}
              </Button>
            </div>
          </div>
        </footer>
      </div>
      <p aria-live="polite" role="status" className="sr-only">
        {text.announce(state.index + 1, total, title)}
      </p>
    </div>
  )
}

export default WelcomeFlow
