import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { specReply, validated } from '../../contracts/openapiExample.ts'
import type { WelcomeStep } from '../course-map/data/types.ts'
import {
  closingStepsFor,
  congratulationsValues,
  remainingContent,
  stageOf,
} from './closingJourney.ts'
import { parseClosingStatus } from './closingStatus.ts'

// GET /trainer/closing as the backend declares it (contracts/openapi.json). Every body here is
// built from the spec and checked against it, so a drift of the contract fails in this file.

const reply = (overrides: Record<string, unknown> = {}) =>
  parseClosingStatus(specReply('GET', '/trainer/closing', 200, overrides))

const attempts = (used: number, max = 3) => ({ used, max })
const checkin = (status: string, percent: string | null = '85.5') => ({
  status,
  percent,
  pass_percent: 70,
  pass_operator: 'gt',
  attempts: attempts(1, 2),
})
const outcome = (finalStatus: string, extra: Record<string, unknown> = {}, ci = 'not_passed') =>
  validated('GET', '/trainer/closing', 200, {
    enforced: true,
    preview: false,
    available: false,
    reason: null,
    progress: { completed: 2, total: 5 },
    final: null,
    outcome: {
      checkin: checkin(ci),
      final: { status: finalStatus, reason: null, attempts: attempts(0), ...extra },
      scorm_gate: { satisfied: false, reason: null },
    },
  })

const parsed = (body: unknown) => parseClosingStatus(body)

describe('the closing status the backend sends', () => {
  it('reads the minimal answer of a course without a closing flow', () => {
    const status = reply({ available: false, reason: 'not_enabled' })
    assert.equal(status.available, false)
    assert.equal(status.reason, 'not_enabled')
    assert.equal(status.outcome, null)
    assert.equal(stageOf(status), 'unknown')
  })
  it('reads the outcome, the attempts and the gate', () => {
    const status = parsed(outcome('required', { attempts: attempts(1) }))
    assert.equal(status.outcome?.final.status, 'required')
    assert.deepEqual(status.outcome?.final.attempts, { used: 1, max: 3 })
    assert.equal(status.outcome?.checkin?.passPercent, 70)
    assert.equal(status.outcome?.scormGate.satisfied, false)
    assert.deepEqual(status.progress, { completed: 2, total: 5 })
  })
  it('does not turn a status it does not know into a journey', () => {
    const body = outcome('required') as { outcome: { final: { status: string } } }
    body.outcome.final.status = 'a_new_status'
    assert.equal(stageOf(parsed(body)), 'unknown')
  })
  it('refuses a body that is not the contract', () => {
    assert.throws(() => parseClosingStatus(null))
    assert.throws(() => parseClosingStatus({ enforced: 'yes' }))
  })
})

describe('the stage of the journey comes from the backend status alone', () => {
  const stage = (final: string) => stageOf(parsed(outcome(final)))
  it('maps each final status', () => {
    assert.equal(stage('not_required_passed_checkin'), 'passed_checkin')
    assert.equal(stage('required'), 'final_ready')
    assert.equal(stage('locked'), 'final_locked')
    assert.equal(stage('passed'), 'final_passed')
    assert.equal(stage('exhausted'), 'exhausted')
  })
  it('never works it out from a score: a high percent with a not_passed status is not passed', () => {
    const body = outcome('required', {}, 'not_passed') as {
      outcome: { checkin: { percent: string } }
    }
    body.outcome.checkin.percent = '99.99'
    assert.equal(stageOf(parsed(body)), 'final_ready')
  })
  it('knows nothing without a status', () => {
    assert.equal(stageOf(null), 'unknown')
    assert.equal(stageOf(undefined), 'unknown')
  })
})

describe('the closing flow a student sees', () => {
  const step = (key: string, extra: object): WelcomeStep =>
    ({ key, title: key, mandatory: true, revision: 1, ...extra }) as WelcomeStep
  const html = step('html00001', {
    type: 'html',
    html: '<p>x</p>',
    css: null,
    ack: null,
    minSeconds: 0,
  })
  const final = step('final0001', { type: 'assessment', purpose: 'final' })
  const activity = step('act000001', { type: 'moodle_activity', cmid: 41 })
  const steps = [html, activity, final]

  it('leaves out the final exam after a passed check-in', () => {
    const passed = parsed(outcome('not_required_passed_checkin', { attempts: null }, 'passed'))
    assert.deepEqual(
      closingStepsFor(steps, passed).map((s) => s.key),
      ['html00001', 'act000001']
    )
  })
  it('keeps every step for everyone else', () => {
    for (const final of ['required', 'locked', 'passed', 'exhausted'])
      assert.equal(closingStepsFor(steps, parsed(outcome(final))).length, 3, final)
    assert.equal(closingStepsFor(steps, null).length, 3)
  })
  it('keeps a flow that the exemption would empty, so the author sees the mistake', () => {
    const passed = parsed(outcome('not_required_passed_checkin', {}, 'passed'))
    assert.equal(closingStepsFor([final], passed).length, 1)
  })
})

describe('the card "Continuar al cierre"', () => {
  it('says how much content is left from the counts alone', () => {
    assert.equal(remainingContent(parsed(outcome('locked'))), 3)
    assert.equal(remainingContent(null), null)
  })
})

describe('what the congratulations screen substitutes', () => {
  it('takes the score and the threshold as the backend reports them', () => {
    const status = parsed(outcome('not_required_passed_checkin', {}, 'passed'))
    assert.deepEqual(congratulationsValues(status, 'checkin'), { score: '85.5', threshold: 70 })
  })
  it('takes the final’s own pass mark where it is known', () => {
    assert.equal(congratulationsValues(null, 'final', 85).threshold, 85)
    assert.equal(congratulationsValues(null, 'checkin', 85).threshold, null)
  })
  it('has no score for a final it cannot read, and still the threshold of the check-in', () => {
    const status = parsed(outcome('passed'))
    assert.equal(congratulationsValues(status, 'final').score, null)
    assert.equal(congratulationsValues(null, 'checkin').threshold, null)
  })
})
