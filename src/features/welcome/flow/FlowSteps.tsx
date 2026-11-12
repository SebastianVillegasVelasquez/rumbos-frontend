import {
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
  type Dispatch,
  type ReactNode,
  type RefObject,
} from 'react'
import { ExternalLink, Download, Play } from 'lucide-react'
import { Button } from '../../../components/ui/Button.tsx'
import { es } from '../../../i18n/es.ts'
import { API_BASE_URL } from '../../course-map/data/client.ts'
import { resolveImageUrl } from '../../course-map/data/assets.ts'
import type {
  WelcomeDocument,
  WelcomeHtmlStep,
  WelcomePdfStep,
  WelcomeQuizStep,
  WelcomeVideoStep,
} from '../../course-map/data/types.ts'
import { VideoFrame } from '../../content/VideoFrame.tsx'
import { useVideoPanelWidth } from '../../content/useVideoPanelWidth.ts'
import { useEmbed } from '../../embed/EmbedContext.ts'
import {
  getHostFlowReceivedCount,
  getHostQuizView,
  subscribeHostFlow,
} from '../../embed/hostFlow.ts'
import { isHostOverlayOpen, subscribeHostOverlay } from '../../embed/hostOverlay.ts'
import { subscribeHostStateReceived, useHostState } from '../../embed/hostState.ts'
import {
  VIDEO_LOAD_TIMEOUT_MS,
  playerOrigin,
  playerUrl,
  signalOf,
  subscribeMessages,
} from '../videoPlayer.ts'
import { quizOf, videoOf, type FlowEvent, type FlowState } from './flowReducer.ts'
import { assetsOrigin, htmlStepFrameAttributes } from './htmlStepDocument.ts'
import { showTroubleAction } from './videoStepState.ts'
import { createQuizWatcher, gateFromView, quizAvailability } from './quizWatcher.ts'

const text = es.flow

interface StepContext {
  state: FlowState
  dispatch: Dispatch<FlowEvent>
}

// ---- welcome ---------------------------------------------------------------------

export const StepWelcome = ({ message, extra }: { message: string | null; extra?: ReactNode }) => (
  <div className="space-y-4">
    {message && <p className="text-lg whitespace-pre-line break-words">{message}</p>}
    {extra}
  </div>
)

// ---- video -----------------------------------------------------------------------

export const StepVideo = ({
  step,
  state,
  dispatch,
  viewRef,
  columnRef,
  onStart,
  onHold,
}: StepContext & {
  step: WelcomeVideoStep
  viewRef: RefObject<HTMLElement | null>
  columnRef: RefObject<HTMLElement | null>
  // The click that starts the video is the first gesture of the viewer: the music
  // may start with it. Held while the video is heard.
  onStart: () => void
  onHold: (held: boolean) => void
}) => {
  const video = videoOf(state, step.key)
  const started = video.phase !== 'idle'
  const frameRef = useRef<HTMLIFrameElement>(null)
  // Nothing of the provider loads before the click.
  const src = started ? playerUrl(step.video.provider, step.video.videoId) : null
  const width = useVideoPanelWidth(viewRef, columnRef, started)

  // Strict origin and source: only the player frame we created counts.
  useEffect(() => {
    if (!started) return
    const origin = playerOrigin(step.video.provider)
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin) return
      if (event.source === null || event.source !== frameRef.current?.contentWindow) return
      const signal = signalOf(step.video.provider, event.data)
      if (!signal) return
      dispatch({ type: 'video', event: { type: 'signal', signal } })
      if (signal === 'playing') onHold(true)
      else if (signal === 'paused' || signal === 'ended') onHold(false)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [started, step.video.provider, dispatch, onHold])

  // One timeout for "no start signal": the curtain uses the same constant.
  useEffect(() => {
    if (video.phase !== 'loading') return
    const timer = window.setTimeout(
      () => dispatch({ type: 'video', event: { type: 'timeout' } }),
      VIDEO_LOAD_TIMEOUT_MS
    )
    return () => window.clearTimeout(timer)
  }, [video.phase, dispatch])

  // Leaving the step lets the music go back.
  useEffect(() => () => onHold(false), [onHold])

  const trouble = showTroubleAction(video, step.allowFallback)

  if (!started || !src) {
    return (
      <div className="flex flex-col items-start gap-3">
        <Button
          variant="secondary"
          onClick={() => {
            onStart()
            onHold(true)
            dispatch({ type: 'video', event: { type: 'click' } })
          }}
        >
          <Play size={18} strokeWidth={3} aria-hidden />
          {text.video.play}
        </Button>
        <p className="text-sm text-ink-soft">{text.video.captions}</p>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center gap-3" data-video-phase={video.phase}>
      <VideoFrame
        src={src}
        title={text.video.frameTitle}
        frameRef={frameRef}
        frameClassName="video-panel"
        frameStyle={width === null ? undefined : { width }}
        onLoad={() => {
          for (const message of subscribeMessages(step.video.provider))
            frameRef.current?.contentWindow?.postMessage(message, playerOrigin(step.video.provider))
        }}
      />
      {trouble && (
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-sm text-ink-soft">{text.video.troubleHint}</p>
          <button
            type="button"
            onClick={() => dispatch({ type: 'video-fallback' })}
            className="min-h-[44px] px-3 text-sm font-bold text-primary underline underline-offset-4"
          >
            {text.video.trouble}
          </button>
        </div>
      )}
      {video.usedFallback && video.phase !== 'ended' && (
        <p role="status" className="text-sm font-semibold text-ink">
          {text.video.fallbackTaken}
        </p>
      )}
    </div>
  )
}

// ---- html ------------------------------------------------------------------------

export const AckCheckbox = ({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) => {
  const id = useId()
  return (
    <div className="border-soft flex items-start gap-3 rounded-md bg-surface p-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-6 w-6 shrink-0 accent-primary"
      />
      <label htmlFor={id} className="min-w-0 text-base font-semibold break-words text-ink">
        {label}
      </label>
    </div>
  )
}

export const StepHtml = ({ step, state, dispatch }: StepContext & { step: WelcomeHtmlStep }) => {
  const attributes = htmlStepFrameAttributes({
    html: step.html,
    css: step.css,
    origin: assetsOrigin(API_BASE_URL, window.location.origin),
  })
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <iframe
        title={text.html.frameTitle(step.title)}
        sandbox={attributes.sandbox}
        srcDoc={attributes.srcDoc}
        referrerPolicy={attributes.referrerPolicy}
        // Not in React's types yet: where supported the browser enforces the policy
        // on the frame itself, before it parses the document.
        {...({ csp: attributes.csp } as object)}
        // Focusable, so the keyboard can scroll its content.
        tabIndex={0}
        className="border-soft min-h-[40vh] w-full flex-1 rounded-md bg-white"
      />
      {step.ack && (
        <AckCheckbox
          label={step.ack.label}
          checked={state.acked[step.key] === true}
          onChange={(checked) => dispatch({ type: 'ack', checked })}
        />
      )}
    </div>
  )
}

// ---- pdf -------------------------------------------------------------------------

// Embedded viewers often show only the first page on touch devices (iOS), and
// some browsers have none: lead with the buttons there.
const inlinePdfSupported = (): boolean =>
  typeof navigator !== 'undefined' &&
  (navigator as Navigator & { pdfViewerEnabled?: boolean }).pdfViewerEnabled === true &&
  !(typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches)

export const StepPdf = ({
  step,
  document: doc,
  state,
  dispatch,
}: StepContext & { step: WelcomePdfStep; document: WelcomeDocument | null }) => {
  const available = doc !== null && doc.available
  useEffect(() => {
    if (!available) dispatch({ type: 'unavailable' })
  }, [available, dispatch])

  if (!doc || !available) {
    return (
      <p role="status" className="text-base font-semibold">
        {text.pdf.unavailable}
      </p>
    )
  }
  const url = resolveImageUrl(doc.url)
  const inline = inlinePdfSupported()
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <p className="text-sm font-semibold text-ink-soft">
        {doc.title} · {text.pdf.pages(doc.pageCount)}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-md border-strong bg-accent px-4 text-sm font-bold text-ink"
        >
          <ExternalLink size={16} aria-hidden />
          {text.pdf.open}
        </a>
        <a
          href={url}
          download
          className="border-soft inline-flex min-h-[44px] items-center gap-2 rounded-md bg-surface px-4 text-sm font-bold text-ink"
        >
          <Download size={16} aria-hidden />
          {text.pdf.download}
        </a>
      </div>
      {inline ? (
        <iframe
          title={text.pdf.viewerTitle(doc.title)}
          src={url}
          referrerPolicy="no-referrer"
          className="border-soft min-h-[50vh] w-full flex-1 rounded-md bg-white"
        />
      ) : (
        <p className="text-sm text-ink-soft">{text.pdf.touchHint}</p>
      )}
      {step.ack && (
        <AckCheckbox
          label={step.ack.label}
          checked={state.acked[step.key] === true}
          onChange={(checked) => dispatch({ type: 'ack', checked })}
        />
      )}
    </div>
  )
}

// ---- quiz ------------------------------------------------------------------------

const clock = () => Date.now()
const timers = (run: () => void, delayMs: number) => {
  const id = window.setTimeout(run, delayMs)
  return () => window.clearTimeout(id)
}

export const StepQuiz = ({ step, state, dispatch }: StepContext & { step: WelcomeQuizStep }) => {
  const embed = useEmbed()
  const hostState = useHostState()
  const cmid = step.cmid
  const availability = quizAvailability(embed ? hostState : null, cmid)
  const view = useSyncExternalStore(subscribeHostFlow, () =>
    cmid === null ? null : getHostQuizView(cmid)
  )
  const requestQuizResult = embed?.requestQuizResult

  // Not there for this user: the step does not block and records `unavailable`.
  useEffect(() => {
    if (availability !== null)
      dispatch({ type: 'quiz', gate: { kind: 'unavailable', reason: availability } })
  }, [availability, dispatch])

  // The latest answer of the host is the gate.
  useEffect(() => {
    if (availability === null && view) dispatch({ type: 'quiz', gate: gateFromView(view) })
  }, [availability, view, dispatch])

  // Ask for the result on every moment that can change it (see quizWatcher.ts).
  useEffect(() => {
    if (availability !== null || cmid === null || !requestQuizResult) return
    const watcher = createQuizWatcher({
      ask: () => requestQuizResult(cmid),
      answeredCount: getHostFlowReceivedCount,
      now: clock,
      schedule: timers,
      onSilent: () => {
        if (getHostQuizView(cmid) === null)
          dispatch({ type: 'quiz', gate: { kind: 'unavailable', reason: 'silent' } })
      },
    })
    let wasOpen = isHostOverlayOpen()
    const unsubscribeOverlay = subscribeHostOverlay(() => {
      const open = isHostOverlayOpen()
      if (wasOpen && !open) watcher.trigger('overlay-closed')
      wasOpen = open
    })
    const unsubscribeState = subscribeHostStateReceived(() => watcher.trigger('host-state'))
    const onVisible = () => {
      if (document.visibilityState === 'visible') watcher.trigger('visible')
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    watcher.trigger('open')
    return () => {
      watcher.dispose()
      unsubscribeOverlay()
      unsubscribeState()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [availability, cmid, requestQuizResult, dispatch])

  const gate = quizOf(state, step.key)
  const result = gate.kind === 'result' ? gate.result : null
  const finished = result !== null && result.finishedAttempts >= 1

  if (availability !== null || gate.kind === 'unavailable') {
    const reason = gate.kind === 'unavailable' ? gate.reason : (availability ?? 'unavailable')
    return (
      <div className="space-y-3">
        {step.intro && <p className="text-lg whitespace-pre-line break-words">{step.intro}</p>}
        <p role="status" className="border-soft rounded-md bg-surface p-3 text-base font-semibold">
          {text.quiz.unavailable[reason]}
        </p>
      </div>
    )
  }

  // The outcome text of the author, else a neutral line. Never a promise.
  const outcome = !finished
    ? null
    : result.passedThreshold === true
      ? step.outcomeAbove?.trim() || null
      : result.passedThreshold === false
        ? step.outcomeBelow?.trim() || null
        : null

  return (
    <div className="space-y-4">
      {step.intro && <p className="text-lg whitespace-pre-line break-words">{step.intro}</p>}
      {finished && (
        <div role="status" className="border-soft space-y-1 rounded-md bg-surface p-3">
          <p className="text-base font-bold break-words whitespace-pre-line">
            {outcome ?? text.quiz.done}
          </p>
          {result.percent !== null && (
            <p className="text-base">{text.quiz.percent(result.percent)}</p>
          )}
          {result.pendingGrading && <p className="text-base">{text.quiz.pendingGrading}</p>}
        </div>
      )}
      {!finished && gate.kind === 'pending' && !result && (
        <p role="status" className="text-sm text-ink-soft">
          {text.quiz.checking}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant={finished ? 'surface' : 'secondary'}
          onClick={() => embed && cmid !== null && embed.openActivity(cmid)}
        >
          {result?.inProgress ? text.quiz.resume : text.quiz.start}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => embed && cmid !== null && embed.requestQuizResult(cmid)}
        >
          {text.quiz.checkAgain}
        </Button>
      </div>
      {result && result.finishedAttempts > 0 && !finished && (
        <p className="text-sm text-ink-soft">{text.quiz.attempts(result.finishedAttempts)}</p>
      )}
    </div>
  )
}
