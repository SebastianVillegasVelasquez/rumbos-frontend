import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/ui/Button.tsx'
import { es } from '../../i18n/es.ts'
import { useHostOverlayOpen } from '../embed/hostOverlay.ts'
import { viewerStorage } from '../quests/viewerStorage.ts'
import { coachSteps, readCoachDone, rememberCoachDone } from './coachPreference.ts'
import { GAP, GUTTER, TOUCH_TARGET } from './metrics.ts'

interface CoachMarksProps {
  // Misiones is open: step aside, keep the step.
  hidden: boolean
  // A touch screen embedded in the host page: moving the map is opt-in.
  touchGuard: boolean
  // Width the card may use without reaching the bottom-right cluster.
  maxWidth: number
  // The map has music: one more step points at the volume button.
  hasAudio: boolean
  // Width of the bottom-right cluster, which the music step sits beside.
  clusterWidth: number
  stageWidth: number
}

// Three short, skippable steps shown once to a new student: move and zoom, tap
// a bubble, open Misiones. A non-modal dialog: focus goes to its button so a
// keyboard or screen-reader user meets it, Escape skips it, and focus returns to
// where it was. No motion at all, so reduced-motion needs no special case.
export const CoachMarks = ({
  hidden,
  touchGuard,
  maxWidth,
  hasAudio,
  clusterWidth,
  stageWidth,
}: CoachMarksProps) => {
  const [done, setDone] = useState(() => readCoachDone(viewerStorage()))
  const [step, setStep] = useState(0)
  const overlayOpen = useHostOverlayOpen()
  const nextRef = useRef<HTMLButtonElement>(null)
  const returnFocusTo = useRef<Element | null>(null)

  const visible = !done && !overlayOpen && !hidden
  const steps = coachSteps(hasAudio)
  const current = steps[step]

  // Moves focus to the card's button when it appears and on every step.
  useEffect(() => {
    if (!visible) return
    if (step === 0) returnFocusTo.current = document.activeElement
    nextRef.current?.focus()
  }, [visible, step])

  if (!visible) return null

  const finish = () => {
    rememberCoachDone(viewerStorage())
    setDone(true)
    const target = returnFocusTo.current
    if (target instanceof HTMLElement) target.focus()
  }
  const isLast = step === steps.length - 1
  const text = es.coach.steps[current]
  const audioMaxWidth = stageWidth - GUTTER * 3 - clusterWidth - GAP
  const body = current === 'move' && touchGuard ? es.coach.moveTouch : text.body

  // The last step points at the Misiones button (top left); the others sit above
  // Continuar, centered.
  // The music step sits to the left of the bottom-right cluster, where the
  // volume button is.
  const placement =
    current === 'quests'
      ? { left: GUTTER, top: GUTTER + TOUCH_TARGET + GAP }
      : current === 'audio'
        ? { right: GUTTER + clusterWidth + GAP, bottom: GUTTER + TOUCH_TARGET + GAP }
        : { left: '50%', bottom: GUTTER + TOUCH_TARGET + GAP, transform: 'translateX(-50%)' }

  return (
    <div
      role="dialog"
      aria-labelledby="coach-title"
      aria-describedby="coach-body"
      aria-label={es.coach.label}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          finish()
        }
      }}
      className="pointer-events-auto absolute z-40 rounded-lg border-soft bg-surface p-3 text-ink shadow-md"
      style={{
        ...placement,
        width: Math.max(200, Math.min(320, current === 'audio' ? audioMaxWidth : maxWidth)),
      }}
    >
      <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
        {es.coach.progress(step + 1, steps.length)}
      </p>
      <h2 id="coach-title" className="font-heading text-base font-extrabold">
        {text.title}
      </h2>
      <p id="coach-body" className="mt-1 text-sm font-semibold text-ink-soft">
        {body}
      </p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <Button variant="surface" dense size="sm" onClick={finish}>
          {es.coach.skip}
        </Button>
        <Button
          ref={nextRef}
          size="sm"
          onClick={() => (isLast ? finish() : setStep((value) => value + 1))}
        >
          {isLast ? es.coach.done : es.coach.next}
        </Button>
      </div>
    </div>
  )
}
