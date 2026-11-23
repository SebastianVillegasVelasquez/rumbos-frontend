import { useId } from 'react'
import { Button } from '../../components/ui/Button.tsx'
import { esAssessment } from '../../i18n/assessment.es.ts'
import type { SimulatedOutcome } from './simulation.ts'
import type { AssessmentPolicy } from './types.ts'

const text = esAssessment.simulation

// The editor's test panel. It only calls `onSimulate`: the caller decides what that shows,
// and every caller checks `simulationAllowed` first, so a student never reaches it.
export const SimulationTools = ({
  policy,
  active,
  onSimulate,
}: {
  policy: AssessmentPolicy
  active: SimulatedOutcome | null
  onSimulate: (outcome: SimulatedOutcome) => void
}) => {
  const titleId = useId()
  const options: { outcome: SimulatedOutcome; label: string }[] = [
    { outcome: 'pass', label: text.pass },
    { outcome: 'fail', label: text.fail },
    { outcome: 'boundary', label: text.boundary(policy.pass_percent) },
  ]
  return (
    <section
      aria-labelledby={titleId}
      data-testid="simulation-tools"
      className="flex flex-col gap-2 rounded-md bg-sun-tint p-3 text-sun-dark"
    >
      <h3 id={titleId} className="text-sm font-extrabold">
        {text.title}
      </h3>
      <p className="text-sm font-semibold">{text.intro}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(({ outcome, label }) => (
          <Button
            key={outcome}
            variant="surface"
            dense
            aria-pressed={active === outcome}
            onClick={() => onSimulate(outcome)}
          >
            {label}
          </Button>
        ))}
      </div>
    </section>
  )
}
