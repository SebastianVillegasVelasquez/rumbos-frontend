import { Pause, Play, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { esAssessment } from '../../i18n/assessment.es.ts'
import { Button } from '../../components/ui/Button.tsx'
import { loadClip } from './clipSource.ts'

// One spoken clip for the exam and the trainer: a real <audio> element, created
// inside the click that starts it (the only thing iOS and every autoplay policy
// accept), never autoplay. While it plays it holds the ambient music through the
// audio session; every way it stops (pause, end, error, unmount) lets the hold go,
// and the session resumes the music only if the viewer had it on and had not muted
// it. The clip's bytes are fetched with the bearer token as soon as the player shows (an
// <audio src> cannot send one) and played from a blob URL, so the click can still start
// playback in the same call stack; a clip that cannot be fetched or played shows an error
// and a retry that asks the network again. The exam passes no transcript, because reading it would turn listening into
// reading; practice may.

type Session = typeof import('./audioSession.ts').audioSession

const SPEEDS = [0.75, 1, 1.25] as const

export interface ClipPlayerProps {
  url: string
  label: string
  // Practice only.
  transcript?: string | null
  speeds?: boolean
}

const Clip = ({ url, label, transcript = null, speeds = false }: ClipPlayerProps) => {
  const [status, setStatus] = useState<'idle' | 'playing' | 'failed'>('idle')
  const [source, setSource] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [rate, setRate] = useState<number>(1)
  const [shown, setShown] = useState(false)
  const element = useRef<HTMLAudioElement | null>(null)
  const session = useRef<Session | null>(null)
  const release = useRef<(() => void) | null>(null)
  const blobUrl = useRef<string | null>(null)
  // A click that arrived while the clip was still loading: play as soon as it is here.
  const wanted = useRef(false)
  const startRef = useRef<() => void>(() => {})
  const text = esAssessment.items

  // The session loads while the student reads, so the hold can start in the same
  // call stack as the click.
  useEffect(() => {
    let alive = true
    import('./audioSession.ts').then((module) => {
      if (alive) session.current = module.audioSession
    })
    return () => {
      alive = false
    }
  }, [])

  // Fetches the clip; a newer call (a retry, or another url) supersedes an older one.
  const generation = useRef(0)
  const startFetch = useCallback(() => {
    const mine = ++generation.current
    loadClip(url).then(
      (blob) => {
        if (mine !== generation.current) return URL.revokeObjectURL(blob)
        blobUrl.current = blob
        setSource('ready')
        if (wanted.current) {
          wanted.current = false
          startRef.current()
        }
      },
      () => {
        if (mine !== generation.current) return
        wanted.current = false
        setSource('failed')
      }
    )
  }, [url])

  const fetchClip = () => {
    setSource('loading')
    startFetch()
  }

  useEffect(() => {
    startFetch()
    return () => {
      // A counter, not a node: bumping it makes a fetch still in flight give up.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++
      element.current?.pause()
      element.current = null
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current)
      blobUrl.current = null
    }
  }, [startFetch])

  const letGo = () => {
    release.current?.()
    release.current = null
  }

  useEffect(
    () => () => {
      element.current?.pause()
      letGo()
    },
    []
  )

  const play = () => {
    if (!blobUrl.current) return
    // A fresh element on a failed clip, so a retry really asks the network again.
    if (!element.current || status === 'failed') {
      const audio = new Audio()
      audio.preload = 'auto'
      audio.addEventListener('playing', () => {
        setStatus('playing')
        if (!release.current) release.current = session.current?.holdAmbient() ?? null
      })
      const stopped = () => {
        setStatus((s) => (s === 'failed' ? s : 'idle'))
        letGo()
      }
      audio.addEventListener('pause', stopped)
      audio.addEventListener('ended', stopped)
      audio.addEventListener('error', () => {
        setStatus('failed')
        letGo()
      })
      audio.src = blobUrl.current
      element.current = audio
    }
    const audio = element.current
    audio.playbackRate = rate
    // Slow audio keeps the voice's pitch.
    audio.preservesPitch = true
    audio.play().catch(() => {
      setStatus('failed')
      letGo()
    })
  }

  useEffect(() => {
    startRef.current = play
  })

  const toggle = () => {
    if (status === 'playing') return element.current?.pause()
    if (source === 'failed') {
      // The clip itself could not be fetched: ask again, and play when it arrives.
      wanted.current = true
      return fetchClip()
    }
    if (source === 'loading') {
      wanted.current = true
      return
    }
    play()
  }

  const changeRate = (next: number) => {
    setRate(next)
    if (element.current) element.current.playbackRate = next
  }

  const failed = status === 'failed' || source === 'failed'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="surface"
          dense
          onClick={toggle}
          aria-pressed={status === 'playing'}
          aria-busy={source === 'loading'}
          aria-label={`${status === 'playing' ? text.pause : failed ? text.audioRetry : text.listen}: ${label}`}
        >
          {status === 'playing' ? (
            <Pause size={18} strokeWidth={3} aria-hidden />
          ) : failed ? (
            <RotateCcw size={18} strokeWidth={3} aria-hidden />
          ) : (
            <Play size={18} strokeWidth={3} aria-hidden />
          )}
          {status === 'playing' ? text.listening : failed ? text.audioRetry : text.listen}
        </Button>
        {speeds && (
          <div role="group" aria-label={text.speed} className="flex gap-1">
            {SPEEDS.map((speed) => (
              <Button
                key={speed}
                variant={rate === speed ? 'primary' : 'surface'}
                dense
                aria-pressed={rate === speed}
                onClick={() => changeRate(speed)}
              >
                {speed}×
              </Button>
            ))}
          </div>
        )}
        {transcript && (
          <Button variant="ghost" dense aria-expanded={shown} onClick={() => setShown((v) => !v)}>
            {text.transcript}
          </Button>
        )}
      </div>
      {failed && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {text.audioFailed}
        </p>
      )}
      {transcript && shown && (
        <p className="rounded-md bg-surface-muted p-3 text-sm">{transcript}</p>
      )}
    </div>
  )
}

// One clip per url: another url is another clip, with its own bytes and its own state.
export const ClipPlayer = (props: ClipPlayerProps) => <Clip key={props.url} {...props} />
