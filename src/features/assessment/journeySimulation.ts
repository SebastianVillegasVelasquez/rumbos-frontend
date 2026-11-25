import type { ClosingStatus, FinalStatus } from './closingStatus.ts'

// The editor's "Simular recorrido": a made-up ClosingStatus built from what the editor chose, fed
// to the very same journey code the student's screens use. It lives in memory only: nothing is
// sent, saved or counted, and the browser never touches Moodle (C4).

export type SimScenario = 'A' | 'B'

export interface SimState {
  scenario: SimScenario
  // Every required activity done (scenario B): until then the closing stays locked.
  contentDone: boolean
  // One entry per final attempt taken, true when it passed.
  attempts: boolean[]
}

export const SIM_MAX_ATTEMPTS = 3
export const SIM_CHECKIN = { percent: '85.50', passPercent: 70, passOperator: 'gt' } as const

export const initialSim = (scenario: SimScenario = 'A'): SimState => ({
  scenario,
  contentDone: false,
  attempts: [],
})

export const simPassed = (state: SimState) => state.attempts.includes(true)
export const simExhausted = (state: SimState) =>
  !simPassed(state) && state.attempts.length >= SIM_MAX_ATTEMPTS

export const simAttempt = (state: SimState, passed: boolean): SimState =>
  state.scenario === 'B' && state.contentDone && !simPassed(state) && !simExhausted(state)
    ? { ...state, attempts: [...state.attempts, passed] }
    : state

export const simStatus = (state: SimState): ClosingStatus => {
  const checkinPassed = state.scenario === 'A'
  let final: FinalStatus
  if (checkinPassed) final = 'not_required_passed_checkin'
  else if (simPassed(state)) final = 'passed'
  else if (simExhausted(state)) final = 'exhausted'
  else final = state.contentDone ? 'required' : 'locked'
  const used = state.attempts.length
  return {
    enforced: true,
    preview: true,
    available: checkinPassed || (state.contentDone && final === 'required'),
    reason: checkinPassed || state.contentDone ? null : 'scorm_incomplete',
    progress: state.contentDone ? { completed: 5, total: 5 } : { completed: 2, total: 5 },
    final: checkinPassed ? null : { attempts: { used, max: SIM_MAX_ATTEMPTS } },
    outcome: {
      checkin: {
        status: checkinPassed ? 'passed' : 'not_passed',
        percent: checkinPassed ? SIM_CHECKIN.percent : '40.00',
        passPercent: SIM_CHECKIN.passPercent,
        passOperator: SIM_CHECKIN.passOperator,
        attempts: { used: 1, max: 2 },
      },
      final: {
        status: final,
        reason: final === 'exhausted' ? 'no_attempts_left' : null,
        attempts: checkinPassed ? null : { used, max: SIM_MAX_ATTEMPTS },
      },
      scormGate: {
        satisfied: checkinPassed || state.contentDone,
        reason: checkinPassed ? 'passed_checkin' : null,
      },
    },
  }
}
