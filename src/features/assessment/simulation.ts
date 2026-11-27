import { SECTION_ORDER, type AssessmentPolicy, type AssessmentResult, type Band } from './types.ts'

// The simulated exam results of "Simular recorrido" (journeySimulation.ts). Nothing here calls
// the network, writes a result or talks to the host: it only builds a value of the same type
// the submit endpoint answers with (checked against the spec's `Result` in the tests) so the
// real result component can draw it.

export type SimulatedOutcome = 'pass' | 'fail' | 'boundary'

// The backend's rule as the policy declares it: `gt` must be strictly above the threshold,
// `gte` may equal it. Used only to label the simulation; the real verdict is the server's.
export const passesRule = (percent: number, policy: AssessmentPolicy): boolean =>
  policy.pass_operator === 'gte' ? percent >= policy.pass_percent : percent > policy.pass_percent

const decimal = (value: number): string => value.toFixed(2)

const bandOf = (percent: number): Band =>
  percent >= 85
    ? 'achieved'
    : percent >= 70
      ? 'consolidating'
      : percent >= 50
        ? 'developing'
        : 'emerging'

// The percent each outcome shows: well above the threshold, exactly on it, or well below.
export const simulatedPercent = (outcome: SimulatedOutcome, policy: AssessmentPolicy): number => {
  const threshold = policy.pass_percent
  if (outcome === 'boundary') return threshold
  if (outcome === 'pass') return Math.min(100, Math.max(threshold + 10, 90))
  return Math.max(0, threshold - 20)
}

export const simulateResult = (
  outcome: SimulatedOutcome,
  policy: AssessmentPolicy,
  attempts: { used: number; max: number }
): AssessmentResult => {
  const percent = simulatedPercent(outcome, policy)
  const used = Math.min(attempts.max, attempts.used + 1)
  return {
    status: 'submitted',
    percent: decimal(percent),
    passed: passesRule(percent, policy),
    band: bandOf(percent),
    // Every section at the same percent: the profile is a placeholder, not a score.
    by_section: SECTION_ORDER.map((key) => ({
      key,
      points: decimal(percent),
      max: 100,
      percent: decimal(percent),
      weight: 100 / SECTION_ORDER.length,
    })),
    by_module: [],
    attempts: { used, max: attempts.max },
    gain: null,
    // Never "synced": nothing was sent, so the result must not say the course was completed.
    sync: { state: 'not_required' },
  }
}
