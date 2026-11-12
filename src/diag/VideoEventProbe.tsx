import { useEffect, useRef, useState } from 'react'
import { es } from '../i18n/es.ts'
import { parseVideoInput } from '../features/content/video.ts'
import type { VideoProvider } from '../features/content/contentTypes.ts'
import {
  VIDEO_LOAD_TIMEOUT_MS,
  playerOrigin,
  playerUrl,
  subscribeMessages,
} from '../features/welcome/videoPlayer.ts'
import { describeMessage, formatLog, pushLine, type ProbeLine } from './videoProbe.ts'

const text = es.diag.probe

interface Running {
  provider: VideoProvider
  videoId: string
  startedAt: number
}

// Loads the real player after a click and lists what it says to its embedder
// (ready, play, pause, ended, error), with the time. It uses the same origin and
// source checks as the welcome flow. Nothing is requested before the click and
// nothing is stored; the log lives in this component only.
const VideoEventProbe = () => {
  const [provider, setProvider] = useState<VideoProvider>('youtube')
  const [input, setInput] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [running, setRunning] = useState<Running | null>(null)
  const [lines, setLines] = useState<ProbeLine[]>([])
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle')
  const frameRef = useRef<HTMLIFrameElement>(null)

  const add = (label: string) => setLines((current) => pushLine(current, { at: Date.now(), label }))

  useEffect(() => {
    if (!running) return
    const origin = playerOrigin(running.provider)
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin) return
      if (event.source === null || event.source !== frameRef.current?.contentWindow) return
      const label = describeMessage(running.provider, event.data)
      if (label) add(label)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [running])

  // The same single timeout as the flow: no start signal, then the way out.
  const sawStart = lines.some((line) => /^(ready|playing)/.test(line.label))
  useEffect(() => {
    if (!running || sawStart) return
    const timer = window.setTimeout(
      () => add(text.noStart(VIDEO_LOAD_TIMEOUT_MS / 1000)),
      VIDEO_LOAD_TIMEOUT_MS
    )
    return () => window.clearTimeout(timer)
  }, [running, sawStart])

  const start = () => {
    const ref = parseVideoInput(input, provider)
    if (!ref) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    setProvider(ref.provider)
    setLines([{ at: Date.now(), label: 'click' }])
    setCopy('idle')
    setRunning({ ...ref, startedAt: Date.now() })
  }

  const src = running ? playerUrl(running.provider, running.videoId) : null
  const log = running
    ? formatLog(
        running.provider,
        running.videoId,
        running.startedAt,
        lines,
        typeof navigator === 'undefined' ? '' : navigator.userAgent
      )
    : ''

  const copyLog = async () => {
    try {
      await navigator.clipboard.writeText(log)
      setCopy('copied')
    } catch {
      setCopy('failed')
    }
  }

  return (
    <details className="mt-2 border-t-2 border-black pt-2 font-sans">
      <summary className="min-h-[28px] cursor-pointer font-bold">{text.title}</summary>
      <p className="my-1">{text.hint}</p>
      {!running ? (
        <form
          className="flex flex-col gap-1"
          onSubmit={(event) => {
            event.preventDefault()
            start()
          }}
        >
          <label className="flex items-center gap-1">
            <span className="font-bold">{text.provider}</span>
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value as VideoProvider)}
              className="rounded border border-black px-1"
            >
              <option value="youtube">YouTube</option>
              <option value="vimeo">Vimeo</option>
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="font-bold">{text.video}</span>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              aria-invalid={invalid}
              className="rounded border border-black px-1"
            />
          </label>
          {invalid && (
            <p role="alert" className="font-bold">
              {text.invalid}
            </p>
          )}
          <button type="submit" className="min-h-[28px] rounded border border-black px-2 font-bold">
            {text.start}
          </button>
        </form>
      ) : (
        <div className="flex flex-col gap-1">
          {src && (
            <div className="relative aspect-video w-full bg-black">
              <iframe
                ref={frameRef}
                title={text.frameTitle}
                src={src}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                referrerPolicy="strict-origin-when-cross-origin"
                className="absolute inset-0 h-full w-full border-0"
                onLoad={() => {
                  add('iframe load')
                  for (const message of subscribeMessages(running.provider))
                    frameRef.current?.contentWindow?.postMessage(
                      message,
                      playerOrigin(running.provider)
                    )
                }}
              />
            </div>
          )}
          <ol aria-live="polite" className="list-none">
            {lines.length === 1 && <li>{text.empty}</li>}
            {log
              .split('\n')
              .slice(2)
              .map((line, index) => (
                <li key={index} className="break-words">
                  {line}
                </li>
              ))}
          </ol>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => void copyLog()}
              className="min-h-[28px] rounded border border-black px-2 font-bold"
            >
              {text.copy}
            </button>
            <button
              type="button"
              onClick={() => setRunning(null)}
              className="min-h-[28px] rounded border border-black px-2 font-bold"
            >
              {text.again}
            </button>
          </div>
          {copy === 'copied' && <p role="status">{text.copied}</p>}
          {copy === 'failed' && (
            <>
              <p role="status">{text.copyFailed}</p>
              <textarea
                readOnly
                value={log}
                rows={6}
                onFocus={(event) => event.currentTarget.select()}
                className="w-full rounded border border-black p-1"
              />
            </>
          )}
        </div>
      )}
    </details>
  )
}

export default VideoEventProbe
