import type { MapSettings, WelcomeAssessmentStep, WelcomeStep } from '../course-map/data/types.ts'
import type { ClosingStatus, FinalStatus } from './closingStatus.ts'
import { assessmentsOf } from './editor/trainingForm.ts'
import { passesRule, simulatedPercent, type SimulatedOutcome } from './simulation.ts'
import type { AssessmentPolicy } from './types.ts'

// The editor's "Simular recorrido", the only simulator: one state for the whole journey, from
// the welcome flow and its check-in to the closing and its final exam. Every simulated result,
// wherever it is pressed, goes through here, and the state is turned into a made-up
// ClosingStatus fed to the very same journey code the student's screens use. It lives in memory
// only: nothing is sent, saved or counted, and the browser never touches Moodle (C4).

export interface SimRules {
  // The map's pass rule (and the exam's time limit, which the result screen's type carries).
  policy: AssessmentPolicy
  checkinMaxAttempts: number
  finalMaxAttempts: number
}

// The map's own settings, over the defaults the contract declares (80 %, strictly above).
export const simRulesOf = (settings: MapSettings): SimRules => {
  const assessments = assessmentsOf(settings)
  return {
    policy: {
      pass_percent: assessments.passPercent,
      pass_operator: assessments.passOperator,
      time_limit_min: assessments.final?.timeLimitMin ?? 60,
    },
    checkinMaxAttempts: assessments.checkIn?.maxAttempts ?? 1,
    finalMaxAttempts: assessments.final?.maxAttempts ?? 3,
  }
}

export interface SimState {
  // Raised on every reset: it keys the simulated flows, so nothing of an earlier run survives.
  run: number
  // 'welcome': the welcome flow with the check-in is up. 'journey': the map and what follows.
  phase: 'welcome' | 'journey'
  checkin: SimulatedOutcome | null
  // Every required activity done: until then a student who did not pass has no closing.
  contentDone: boolean
  // One entry per final attempt taken.
  attempts: SimulatedOutcome[]
}

export const initialSim = (run = 0): SimState => ({
  run,
  phase: 'welcome',
  checkin: null,
  contentDone: false,
  attempts: [],
})

export const outcomePasses = (outcome: SimulatedOutcome, rules: SimRules): boolean =>
  passesRule(simulatedPercent(outcome, rules.policy), rules.policy)

export const simCheckinPassed = (state: SimState, rules: SimRules): boolean =>
  state.checkin !== null && outcomePasses(state.checkin, rules)

export const simPassed = (state: Pick<SimState, 'attempts'>, rules: SimRules): boolean =>
  state.attempts.some((outcome) => outcomePasses(outcome, rules))

export const simExhausted = (state: Pick<SimState, 'attempts'>, rules: SimRules): boolean =>
  !simPassed(state, rules) && state.attempts.length >= rules.finalMaxAttempts

// The check-in is sat once per run, as the welcome flow offers it.
export const simCheckin = (state: SimState, outcome: SimulatedOutcome): SimState =>
  state.checkin === null ? { ...state, checkin: outcome } : state

export const simWelcomeDone = (state: SimState): SimState =>
  state.checkin === null ? state : { ...state, phase: 'journey' }

export const simAllDone = (state: SimState, rules: SimRules): SimState =>
  state.checkin !== null && !simCheckinPassed(state, rules)
    ? { ...state, contentDone: true }
    : state

export const simCanAttempt = (state: SimState, rules: SimRules): boolean =>
  state.contentDone && !simPassed(state, rules) && !simExhausted(state, rules)

export const simAttempt = (
  state: SimState,
  outcome: SimulatedOutcome,
  rules: SimRules
): SimState =>
  simCanAttempt(state, rules) ? { ...state, attempts: [...state.attempts, outcome] } : state

// The number of the last final attempt when it failed; null before any attempt and after a pass.
export const simLastFailure = (state: SimState, rules: SimRules): number | null =>
  state.attempts.length > 0 && !simPassed(state, rules) ? state.attempts.length : null

// The status the backend would answer at this point; null while the check-in is not sat.
export const simStatus = (
  state: SimState,
  rules: SimRules,
  activities: number
): ClosingStatus | null => {
  if (state.checkin === null) return null
  const checkinPassed = simCheckinPassed(state, rules)
  let final: FinalStatus
  if (checkinPassed) final = 'not_required_passed_checkin'
  else if (simPassed(state, rules)) final = 'passed'
  else if (simExhausted(state, rules)) final = 'exhausted'
  else final = state.contentDone ? 'required' : 'locked'
  const attempts = checkinPassed
    ? null
    : { used: state.attempts.length, max: rules.finalMaxAttempts }
  const reason =
    final === 'exhausted' ? 'no_attempts_left' : final === 'locked' ? 'scorm_incomplete' : null
  return {
    enforced: true,
    preview: true,
    available: checkinPassed || final === 'required',
    reason,
    progress: { completed: state.contentDone ? activities : 0, total: activities },
    final: attempts ? { attempts } : null,
    outcome: {
      checkin: {
        status: checkinPassed ? 'passed' : 'not_passed',
        percent: simulatedPercent(state.checkin, rules.policy).toFixed(2),
        passPercent: rules.policy.pass_percent,
        passOperator: rules.policy.pass_operator,
        attempts: { used: 1, max: rules.checkinMaxAttempts },
      },
      final: { status: final, reason, attempts },
      scormGate: {
        satisfied: checkinPassed || state.contentDone,
        reason: checkinPassed ? 'passed_checkin' : null,
      },
    },
  }
}

export const SIM_CHECKIN_KEY = 'simcheckin'

const isCheckinStep = (step: WelcomeStep): boolean =>
  step.type === 'assessment' && step.purpose === 'check_in'

// The welcome flow a simulation plays: the map's own, as a student gets it. A map whose welcome
// has no check-in still needs one to start the journey, so one is added and the panel says so.
export const simWelcomeSteps = (
  welcome: MapSettings['welcome'],
  checkinTitle: string
): { steps: WelcomeStep[]; addedCheckin: boolean } => {
  const own = welcome && welcome.enabled !== false ? (welcome.steps ?? []) : []
  if (own.some(isCheckinStep)) return { steps: own, addedCheckin: false }
  const added: WelcomeAssessmentStep = {
    type: 'assessment',
    purpose: 'check_in',
    key: SIM_CHECKIN_KEY,
    title: checkinTitle,
    mandatory: true,
    revision: 1,
  }
  return { steps: [...own, added], addedCheckin: true }
}
