import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { MapSettings, MapWelcome, WelcomeStep } from '../course-map/data/types.ts'
import { closingStepsFor, stageOf } from './closingJourney.ts'
import {
  SIM_CHECKIN_KEY,
  initialSim,
  simAllDone,
  simAttempt,
  simCheckin,
  simLastFailure,
  simRulesOf,
  simStatus,
  simWelcomeDone,
  simWelcomeSteps,
  type SimRules,
  type SimState,
} from './journeySimulation.ts'

const settings = (assessments?: object) =>
  ({ schemaVersion: 1, ...(assessments && { assessments }) }) as unknown as MapSettings

const rules = simRulesOf(settings())
const inclusive = simRulesOf(settings({ passOperator: 'gte' }))

const stage = (state: SimState, own: SimRules = rules) => stageOf(simStatus(state, own, 5))
const failed = () => simCheckin(initialSim(), 'fail')
const ready = () => simAllDone(failed(), rules)

const finalStep = {
  key: 'final0001',
  title: 'Final',
  mandatory: true,
  revision: 1,
  type: 'assessment',
  purpose: 'final',
} as WelcomeStep
const htmlStep = {
  key: 'first0001',
  title: 'x',
  mandatory: true,
  revision: 1,
  type: 'html',
} as WelcomeStep

describe('the pass rule of a simulation', () => {
  it('is 80 %, strictly above, when the map says nothing', () => {
    assert.equal(rules.policy.pass_percent, 80)
    assert.equal(rules.policy.pass_operator, 'gt')
    assert.equal(rules.finalMaxAttempts, 3)
  })
  it('is the map’s when it says something', () => {
    const own = simRulesOf(
      settings({
        passPercent: 65,
        passOperator: 'gte',
        final: { formId: 'f', maxAttempts: 2, timeLimitMin: 30 },
      })
    )
    assert.equal(own.policy.pass_percent, 65)
    assert.equal(own.policy.pass_operator, 'gte')
    assert.equal(own.finalMaxAttempts, 2)
    assert.equal(
      simStatus(simCheckin(initialSim(), 'boundary'), own, 1)?.outcome?.checkin?.percent,
      '65.00'
    )
  })
  it('exactly on the threshold does not pass with gt, and does with gte', () => {
    const boundary = simCheckin(initialSim(), 'boundary')
    assert.equal(stage(boundary), 'final_locked')
    assert.equal(stage(boundary, inclusive), 'passed_checkin')
  })
})

describe('the journey simulation', () => {
  it('says nothing before the check-in, and cannot leave the welcome flow without it', () => {
    assert.equal(simStatus(initialSim(), rules, 5), null)
    assert.equal(simWelcomeDone(initialSim()).phase, 'welcome')
    assert.equal(simWelcomeDone(failed()).phase, 'journey')
  })
  it('sits the check-in once', () => {
    assert.equal(simCheckin(failed(), 'pass').checkin, 'fail')
  })
  it('a passed check-in leaves the final out of the closing', () => {
    const status = simStatus(simCheckin(initialSim(), 'pass'), rules, 5)
    assert.equal(stageOf(status), 'passed_checkin')
    assert.deepEqual(closingStepsFor([htmlStep, finalStep], status), [htmlStep])
    assert.equal(status?.outcome?.final.attempts, null)
  })
  it('a failed check-in is locked on content, then asks for the final inside the closing', () => {
    assert.equal(stage(failed()), 'final_locked')
    assert.equal(simStatus(failed(), rules, 5)?.outcome?.final.reason, 'scorm_incomplete')
    const status = simStatus(ready(), rules, 5)
    assert.equal(stageOf(status), 'final_ready')
    assert.deepEqual(status?.progress, { completed: 5, total: 5 })
    assert.equal(closingStepsFor([htmlStep, finalStep], status).length, 2)
  })
  it('counts the failed attempts and ends in the final congratulations on a pass', () => {
    let state = simAttempt(ready(), 'fail', rules)
    assert.equal(simLastFailure(state, rules), 1)
    state = simAttempt(state, 'boundary', rules)
    assert.equal(simLastFailure(state, rules), 2)
    state = simAttempt(state, 'pass', rules)
    assert.equal(stage(state), 'final_passed')
    assert.equal(simLastFailure(state, rules), null)
    assert.equal(simAttempt(state, 'fail', rules), state)
  })
  it('the third failure exhausts the attempts', () => {
    let state = ready()
    for (let i = 0; i < 5; i++) state = simAttempt(state, 'fail', rules)
    assert.equal(state.attempts.length, 3)
    assert.equal(stage(state), 'exhausted')
  })
  it('refuses attempts and "all done" out of turn', () => {
    assert.equal(simAttempt(failed(), 'pass', rules).attempts.length, 0)
    assert.equal(simAllDone(initialSim(), rules).contentDone, false)
    assert.equal(simAllDone(simCheckin(initialSim(), 'pass'), rules).contentDone, false)
  })
  it('a reset starts a new run with nothing left over', () => {
    assert.deepEqual(initialSim(4), {
      run: 4,
      phase: 'welcome',
      checkin: null,
      contentDone: false,
      attempts: [],
    })
  })
})

describe('the welcome flow a simulation plays', () => {
  const welcome = (steps: WelcomeStep[], enabled = true) =>
    ({ enabled, steps }) as unknown as MapWelcome
  const checkin = { ...finalStep, key: 'check0001', purpose: 'check_in' } as WelcomeStep

  it('is the map’s own when it has the check-in', () => {
    const played = simWelcomeSteps(welcome([htmlStep, checkin]), 'Diagnóstico')
    assert.deepEqual(played, { steps: [htmlStep, checkin], addedCheckin: false })
  })
  it('gets a check-in added when the map has none, and says so', () => {
    const played = simWelcomeSteps(welcome([htmlStep]), 'Diagnóstico')
    assert.equal(played.addedCheckin, true)
    assert.deepEqual(
      played.steps.map((step) => step.key),
      ['first0001', SIM_CHECKIN_KEY]
    )
  })
  it('does not play steps no student sees', () => {
    assert.deepEqual(
      simWelcomeSteps(welcome([htmlStep], false), 'D').steps.map((step) => step.key),
      [SIM_CHECKIN_KEY]
    )
    assert.equal(simWelcomeSteps(undefined, 'D').steps.length, 1)
  })
})
