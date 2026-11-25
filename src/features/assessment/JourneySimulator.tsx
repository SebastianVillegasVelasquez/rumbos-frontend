import { Button } from '../../components/ui/Button.tsx'
import { esCongratulations } from '../../i18n/congratulations.es.ts'
import {
  SIM_MAX_ATTEMPTS,
  initialSim,
  simAttempt,
  simExhausted,
  simPassed,
  type SimState,
} from './journeySimulation.ts'

const text = esCongratulations.simulator

// Editor-only panel over the student view: pick a journey, mark the content done, play final
// attempts. Everything is in memory; the banner says so and Reset starts again.
export const JourneySimulator = ({
  state,
  onChange,
}: {
  state: SimState | null
  onChange: (next: SimState | null) => void
}) => (
  <aside
    aria-label={text.heading}
    data-testid="journey-simulator"
    className="pointer-events-auto absolute left-3 top-14 z-50 flex max-w-xs flex-col gap-2 rounded-md bg-surface p-3 text-sm text-ink shadow-lg"
  >
    <p className="font-heading font-extrabold">{text.heading}</p>
    {state === null ? (
      <div className="flex flex-col gap-2">
        <Button size="sm" onClick={() => onChange(initialSim('A'))}>
          {text.scenarioA}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onChange(initialSim('B'))}>
          {text.scenarioB}
        </Button>
      </div>
    ) : (
      <>
        <p role="status" className="rounded-md bg-sun-tint p-2 font-bold text-sun-dark">
          {text.banner}
        </p>
        {state.scenario === 'B' && (
          <div className="flex flex-col gap-2">
            {!state.contentDone && (
              <Button size="sm" onClick={() => onChange({ ...state, contentDone: true })}>
                {text.allDone}
              </Button>
            )}
            {state.contentDone && !simPassed(state) && !simExhausted(state) && (
              <>
                <Button size="sm" onClick={() => onChange(simAttempt(state, true))}>
                  {text.passAttempt}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onChange(simAttempt(state, false))}
                >
                  {text.failAttempt}
                </Button>
              </>
            )}
            <p className="font-semibold text-ink-soft">
              {text.attempts(state.attempts.length, SIM_MAX_ATTEMPTS)}
            </p>
          </div>
        )}
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => onChange(initialSim(state.scenario))}>
            {text.reset}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
            {text.exit}
          </Button>
        </div>
      </>
    )}
  </aside>
)
