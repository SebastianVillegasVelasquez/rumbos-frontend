import { useEffect, useId, type Dispatch } from 'react'
import { Button } from '../../../components/ui/Button.tsx'
import { announce } from '../../../components/ui/announce.ts'
import { esAssessment } from '../../../i18n/assessment.es.ts'
import { ExamResult } from '../../assessment/ExamResult.tsx'
import type { JourneySettings } from '../../assessment/journeyTexts.ts'
import { simExhausted, simPassed } from '../../assessment/journeySimulation.ts'
import { simulateResult, type SimulatedOutcome } from '../../assessment/simulation.ts'
import type { WelcomeAssessmentStep } from '../../course-map/data/types.ts'
import type { FlowEvent, FlowState } from './flowReducer.ts'
import type { FlowSimulation } from './flowSimulation.ts'

const text = esAssessment.simulation
const OUTCOMES: SimulatedOutcome[] = ['pass', 'fail', 'boundary']

// The exam step in "Simular recorrido": no list is read and no attempt can be made. The editor
// says how it went, and sees the same result screen a student would.
export const StepSimulatedExam = ({
  step,
  state,
  dispatch,
  simulation,
  journeyTexts,
}: {
  step: WelcomeAssessmentStep
  state: FlowState
  dispatch: Dispatch<FlowEvent>
  simulation: FlowSimulation
  journeyTexts?: JourneySettings | null
}) => {
  const titleId = useId()
  const { rules, checkin, attempts } = simulation
  const final = step.purpose === 'final'
  // The result shown: the check-in's own, or the final attempt taken on this step just now.
  const sat = state.assessment[step.key] === 'done'
  const outcome = final ? (sat ? (attempts.at(-1) ?? null) : null) : checkin
  const max = final ? rules.finalMaxAttempts : rules.checkinMaxAttempts
  const used = final ? attempts.length : checkin === null ? 0 : 1
  // No attempt left to sit: passed or spent, wherever in the simulation that happened.
  const closed = final && (simPassed({ attempts }, rules) || simExhausted({ attempts }, rules))
  // As for a student: an exam with nothing left to sit does not keep "Terminar" shut.
  useEffect(() => {
    if (closed && !sat) dispatch({ type: 'assessment-done' })
  }, [closed, sat, dispatch])

  const choose = (next: SimulatedOutcome) => {
    simulation.onSimulate(step.purpose, next)
    dispatch({ type: 'assessment-done' })
    announce(text.announce[next])
  }

  if (outcome !== null)
    return (
      <div className="flow-pad">
        <ExamResult
          purpose={step.purpose}
          result={simulateResult(outcome, rules.policy, { used: used - 1, max })}
          preview
          policy={rules.policy}
          simulated={{ outcome }}
          journeyTexts={journeyTexts}
        />
      </div>
    )

  return (
    <div className="flow-pad">
      <section
        aria-labelledby={titleId}
        data-testid="simulated-exam"
        className="flex flex-col gap-3 rounded-md bg-sun-tint p-3 text-sun-dark"
      >
        <h2 id={titleId} className="text-base font-extrabold">
          {text.title}
        </h2>
        {closed ? (
          <p className="text-sm font-semibold">{text.noAttemptLeft}</p>
        ) : (
          <>
            <p className="text-sm font-semibold">{text.intro}</p>
            {final && <p className="text-sm font-bold">{text.attemptNumber(used + 1, max)}</p>}
            <div className="flex flex-wrap gap-2">
              {OUTCOMES.map((option) => (
                <Button key={option} variant="surface" dense onClick={() => choose(option)}>
                  {option === 'boundary' ? text.boundary(rules.policy.pass_percent) : text[option]}
                </Button>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
