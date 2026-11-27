import { useState } from 'react'
import { Button } from '../../components/ui/Button.tsx'
import { esCongratulations } from '../../i18n/congratulations.es.ts'
import {
  simCanAttempt,
  simCheckinPassed,
  type SimRules,
  type SimState,
} from './journeySimulation.ts'
import type { SimulatedOutcome } from './simulation.ts'

const text = esCongratulations.simulator

export interface JourneySimulatorProps {
  state: SimState | null
  rules: SimRules
  // The map's welcome has no check-in: one was added for the simulation.
  addedCheckin: boolean
  hasClosing: boolean
  // The closing flow is on screen: its exam step is where a result is chosen then.
  closingOpen: boolean
  onStart: () => void
  onAllDone: () => void
  onAttempt: (outcome: SimulatedOutcome) => void
  onReset: () => void
  onExit: () => void
}

// The only entry to a simulation: an editor-only panel over the student view. It says where
// the journey stands and holds what a student's own actions cannot do here (finish every
// activity, sit the final without the exam). Everything is in memory; Reset starts again.
export const JourneySimulator = ({
  state,
  rules,
  addedCheckin,
  hasClosing,
  closingOpen,
  onStart,
  onAllDone,
  onAttempt,
  onReset,
  onExit,
}: JourneySimulatorProps) => {
  // A flow fills the stage: the panel can be folded out of its way.
  const [folded, setFolded] = useState(false)
  const threshold = rules.policy.pass_percent
  const failed = state !== null && state.checkin !== null && !simCheckinPassed(state, rules)
  return (
    <aside
      aria-label={text.heading}
      data-testid="journey-simulator"
      className="pointer-events-auto absolute left-3 top-14 z-50 flex max-h-[calc(100%-5rem)] w-64 max-w-[calc(100%-1.5rem)] flex-col gap-2 overflow-y-auto rounded-md bg-surface p-3 text-sm text-ink shadow-lg"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-heading font-extrabold">{text.heading}</p>
        <Button
          size="sm"
          variant="ghost"
          aria-expanded={!folded}
          onClick={() => setFolded(!folded)}
        >
          {folded ? text.unfold : text.fold}
        </Button>
      </div>
      {state !== null && (
        <p role="status" className="rounded-md bg-sun-tint p-2 font-bold text-sun-dark">
          {text.banner}
        </p>
      )}
      {!folded && state === null && (
        <Button size="sm" onClick={onStart}>
          {text.start}
        </Button>
      )}
      {!folded && state !== null && (
        <>
          <p className="font-semibold text-ink-soft">
            {text.passRule(threshold, rules.policy.pass_operator === 'gt')}
          </p>
          {!hasClosing && <p className="font-semibold text-ink-soft">{text.noClosing}</p>}
          {state.phase === 'welcome' ? (
            <>
              <p className="font-semibold">{text.checkinPending}</p>
              {addedCheckin && <p className="font-semibold text-ink-soft">{text.addedCheckin}</p>}
            </>
          ) : (
            <p className="font-bold">{text.checkinResult(!failed)}</p>
          )}
          {state.phase === 'journey' && failed && (
            <div className="flex flex-col gap-2">
              {!state.contentDone && (
                <Button size="sm" onClick={onAllDone}>
                  {text.allDone}
                </Button>
              )}
              {simCanAttempt(state, rules) && !closingOpen && (
                <>
                  <Button size="sm" onClick={() => onAttempt('pass')}>
                    {text.passAttempt}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => onAttempt('fail')}>
                    {text.failAttempt}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => onAttempt('boundary')}>
                    {text.boundaryAttempt(threshold)}
                  </Button>
                </>
              )}
              <p className="font-semibold text-ink-soft">
                {text.attempts(state.attempts.length, rules.finalMaxAttempts)}
              </p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={onReset}>
              {text.reset}
            </Button>
            <Button size="sm" variant="ghost" onClick={onExit}>
              {text.exit}
            </Button>
          </div>
        </>
      )}
    </aside>
  )
}
