import {
  useCallback,
  useEffect,
  useId,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { ArrowLeft, ArrowRight, Hourglass, Info, Lock, Maximize2 } from 'lucide-react'
import { Button } from '../../../components/ui/Button.tsx'
import { useDataSaver } from '../../../fx/dataSaverStore.ts'
import { es } from '../../../i18n/es.ts'
import { resolveImageUrl } from '../../course-map/data/assets.ts'
import type { WelcomeDocument, WelcomeStep } from '../../course-map/data/types.ts'
import { useCurtainMusic } from '../useCurtainMusic.ts'
import { PLACEHOLDER } from '../welcome.ts'
import {
  createFlowState,
  flowReducer,
  gateOf,
  newCompletions,
  toStepInfo,
  videoOf,
  type FlowMode,
  type ProgressEntry,
} from './flowReducer.ts'
import type { FlowPersistence } from './flowPersistence.ts'
import { StepHtml, StepPdf, StepQuiz, StepVideo, StepWelcome } from './FlowSteps.tsx'
import { FlowMusicChoice } from './FlowMusicChoice.tsx'
import { FlowStatus } from './FlowStatus.tsx'
import { FlowStepper } from './FlowStepper.tsx'
import { showTroubleAction } from './videoStepState.ts'
import { offersMusicChoice, previewSwitchStart } from './musicChoice.ts'
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
  const noteId = useId()

  const music = useCurtainMusic({
    enabled: hasMusic && mode !== 'preview',
    startAfterInteraction: track?.startAfterInteraction ?? false,
  })
  // The editor's preview: the switch answers from memory only (nothing plays, the
  // saved mute is neither read nor written).
  const preview = mode === 'preview'
  const [previewOn, setPreviewOn] = useState(() =>
    previewSwitchStart({
      startAfterInteraction: track?.startAfterInteraction ?? false,
      dataSaver,
    })
  )
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
              offersMusicChoice({ hasMusic, stepIndex: state.index }) ? (
                <FlowMusicChoice
                  on={preview ? previewOn : music.on}
                  track={track}
                  dataSaver={dataSaver}
                  onToggle={preview ? () => setPreviewOn((value) => !value) : music.toggle}
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

  const kindName = text.stepKinds[step.type]
  const video = step.type === 'video' ? videoOf(state, step.key) : null
  const trouble =
    step.type === 'video' && video !== null && showTroubleAction(video, step.allowFallback)
  const wide = step.type === 'video' || step.type === 'quiz' || step.type === 'pdf'
  // The first welcome step is a hero: centered, with one centered primary action.
  const hero = step.type === 'welcome' && state.index === 0

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={text.dialog}
      onKeyDown={trapFocus}
      className="absolute inset-0 z-50 flex flex-col overflow-hidden bg-ink text-white"
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

      <div className="flow-stage relative">
        <div className="flow-card" data-wide={wide}>
          <header className="flow-card-head">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <p className="text-sm font-bold">{text.stepLine(state.index + 1, total, kindName)}</p>
              <div className="flex items-center gap-2">
                {onEnterFullscreen && (
                  <Button variant="surface" size="sm" dense onClick={onEnterFullscreen}>
                    <Maximize2 size={16} strokeWidth={2.5} aria-hidden />
                    {/* Icon only on a narrow window; the name stays for assistive tech. */}
                    <span className="max-[480px]:sr-only">{es.welcome.fullscreen}</span>
                  </Button>
                )}
                {(mode === 'review' || skipVisible) && (
                  <Button
                    variant="surface"
                    size="sm"
                    dense
                    onClick={() => dispatch({ type: 'close' })}
                  >
                    {mode === 'review' ? text.close : text.skipPreview}
                  </Button>
                )}
              </div>
            </div>
            <FlowStepper state={state} steps={steps} dispatch={dispatch} />
          </header>

          {mode !== 'normal' && (
            <p
              role="note"
              className="flex-none bg-sun-tint px-[var(--flow-pad)] py-2 text-sm font-semibold text-sun-dark"
            >
              {mode === 'review' ? text.review : text.preview}
            </p>
          )}

          <div className="flow-card-scroll">
            <div key={step.key} className={`flex flex-col ${dataSaver ? '' : 'flow-step-in'}`}>
              <div className={`flow-title-zone ${hero ? 'text-center' : ''}`}>
                {hero && (
                  <p className="mb-2 text-sm font-extrabold tracking-wide text-primary uppercase">
                    {text.stage.eyebrow}
                  </p>
                )}
                <h1
                  ref={headingRef}
                  tabIndex={-1}
                  className="flow-title font-heading font-extrabold outline-none"
                >
                  {title}
                  {!step.mandatory && (
                    <span className="ml-2 align-middle text-sm font-bold text-ink-soft">
                      ({text.optionalTag})
                    </span>
                  )}
                </h1>
              </div>
              {body}
            </div>
          </div>

          <footer className={`flow-card-foot ${hero ? 'justify-center' : 'justify-between'}`}>
            {!hero && (
              <Button
                variant="ghost"
                onClick={() => dispatch({ type: 'back' })}
                disabled={state.index === 0}
              >
                <ArrowLeft size={18} strokeWidth={3} aria-hidden />
                {text.back}
              </Button>
            )}
            <div
              className={`flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 ${hero ? 'justify-center' : 'ml-auto justify-end'}`}
            >
              <div className="flex min-w-0 flex-col items-end gap-1 text-right">
                {note && (
                  <FlowStatus
                    id={noteId}
                    icon={<Hourglass size={16} strokeWidth={2.5} />}
                    className="text-ink-soft"
                  >
                    {note}
                  </FlowStatus>
                )}
                {trouble && (
                  <div className="flex flex-wrap items-center justify-end gap-x-2 text-xs text-ink-soft">
                    <span>{text.video.troubleHint}</span>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'video-fallback' })}
                      className="min-h-[44px] px-1 text-sm font-bold text-primary underline underline-offset-4"
                    >
                      {text.video.trouble}
                    </button>
                  </div>
                )}
                {video?.usedFallback && video.phase !== 'ended' && (
                  <FlowStatus role="status" icon={<Info size={16} strokeWidth={2.5} />}>
                    {text.video.fallbackTaken}
                  </FlowStatus>
                )}
              </div>
              {gate.canSkip && (
                <Button variant="surface" dense onClick={() => dispatch({ type: 'skip' })}>
                  {text.skip}
                </Button>
              )}
              {/* aria-disabled, not disabled: it stays focusable and its note is read. */}
              <Button
                variant="secondary"
                dense={blocked}
                aria-disabled={blocked}
                aria-describedby={blocked && note ? noteId : undefined}
                className={blocked ? 'flow-next-waiting' : hero ? 'px-8' : ''}
                onClick={goNext}
              >
                {blocked && <Lock size={16} strokeWidth={3} aria-hidden />}
                {nextLabel}
                {!blocked && !isLast && <ArrowRight size={18} strokeWidth={3} aria-hidden />}
              </Button>
            </div>
          </footer>
        </div>
      </div>
      <p aria-live="polite" role="status" className="sr-only">
        {text.announce(state.index + 1, total, title)}
      </p>
    </div>
  )
}

export default WelcomeFlow
