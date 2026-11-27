import type { SimRules } from '../../assessment/journeySimulation.ts'
import type { SimulatedOutcome } from '../../assessment/simulation.ts'
import type { AssessmentPurpose } from '../../assessment/types.ts'

// What a flow played by "Simular recorrido" gets: the shared state of the simulation, so a
// result pressed on an exam step is the same one the panel and the journey screens read.
export interface FlowSimulation {
  rules: SimRules
  checkin: SimulatedOutcome | null
  // Every final attempt of this run so far.
  attempts: SimulatedOutcome[]
  onSimulate: (purpose: AssessmentPurpose, outcome: SimulatedOutcome) => void
}
