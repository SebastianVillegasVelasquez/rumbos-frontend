import { Pause, Play, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { esAssessment } from '../../i18n/assessment.es.ts'
import { Button } from '../../components/ui/Button.tsx'

// One spoken clip for the exam and the trainer: a real <audio> element, created
// inside the click that starts it (the only thing iOS and every autoplay policy
// accept), never autoplay. While it plays it holds the ambient music through the
// audio session; every way it stops (pause, end, error, unmount) lets the hold go,
// and the session resumes the music only if the viewer had it on and had not muted
// it. The exam passes no transcript, because reading it would turn listening into
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

export const ClipPlayer = ({ url, label, transcript = null, speeds = false }: ClipPlayerProps) => {
  const [status, setStatus] = useState<'idle' | 'playing' | 'failed'>('idle')
  const [rate, setRate] = useState<number>(1)
  const [shown, setShown] = useState(false)
  const element = useRef<HTMLAudioElement | null>(null)
  const session = useRef<Session | null>(null)
  const release = useRef<(() => void) | null>(null)
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
      audio.src = url
      element.current = audio
    }
    const audio = element.current
    audio.playbackRate = rate
    audio.play().catch(() => {
      setStatus('failed')
      letGo()
    })
  }

  const toggle = () => {
    if (status === 'playing') element.current?.pause()
    else play()
  }

  const changeRate = (next: number) => {
    setRate(next)
    if (element.current) element.current.playbackRate = next
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="surface"
          dense
          onClick={toggle}
          aria-pressed={status === 'playing'}
          aria-label={`${status === 'playing' ? text.pause : text.listen}: ${label}`}
        >
          {status === 'playing' ? (
            <Pause size={18} strokeWidth={3} aria-hidden />
          ) : status === 'failed' ? (
            <RotateCcw size={18} strokeWidth={3} aria-hidden />
          ) : (
            <Play size={18} strokeWidth={3} aria-hidden />
          )}
          {status === 'playing'
            ? text.listening
            : status === 'failed'
              ? text.audioRetry
              : text.listen}
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
      {status === 'failed' && (
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
