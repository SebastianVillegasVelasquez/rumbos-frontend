import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { check, responseSchema } from '../../contracts/openapiSchema.ts'
import { esAssessment } from '../../i18n/assessment.es.ts'
import {
  passesRule,
  simulateResult,
  simulatedPercent,
  simulationAllowed,
  type SimulatedOutcome,
} from './simulation.ts'
import type { AssessmentPolicy } from './types.ts'

const strict: AssessmentPolicy = { pass_percent: 80, pass_operator: 'gt', time_limit_min: 60 }
const inclusive: AssessmentPolicy = { ...strict, pass_operator: 'gte' }
const attempts = { used: 0, max: 3 }
const OUTCOMES: SimulatedOutcome[] = ['pass', 'fail', 'boundary']

describe('the simulation gate', () => {
  it('opens only for an editor in preview', () => {
    assert.equal(simulationAllowed({ preview: true, editorRole: true }), true)
    assert.equal(simulationAllowed({ preview: false, editorRole: true }), false)
    assert.equal(simulationAllowed({ preview: true, editorRole: false }), false)
    assert.equal(simulationAllowed({ preview: false, editorRole: false }), false)
  })

  it('does not open for anything that is not exactly true', () => {
    const loose = { preview: 'true', editorRole: 1 } as unknown as Parameters<
      typeof simulationAllowed
    >[0]
    assert.equal(simulationAllowed(loose), false)
  })
})

describe('the pass rule', () => {
  it('exactly on the threshold does not pass when it must be exceeded', () => {
    assert.equal(passesRule(80, strict), false)
    assert.equal(passesRule(80.01, strict), true)
    assert.equal(passesRule(79.99, strict), false)
  })

  it('exactly on the threshold passes when the policy is inclusive', () => {
    assert.equal(passesRule(80, inclusive), true)
  })
})

describe('simulated results', () => {
  it('pass is above the threshold, fail below it, boundary exactly on it', () => {
    assert.equal(simulatedPercent('pass', strict) > 80, true)
    assert.equal(simulatedPercent('fail', strict) < 80, true)
    assert.equal(simulatedPercent('boundary', strict), 80)
  })

  it('the verdict follows the rule: 80 % does not pass with gt, passes with gte', () => {
    assert.equal(simulateResult('pass', strict, attempts).passed, true)
    assert.equal(simulateResult('fail', strict, attempts).passed, false)
    assert.equal(simulateResult('boundary', strict, attempts).passed, false)
    assert.equal(simulateResult('boundary', inclusive, attempts).passed, true)
  })

  it('counts the simulated attempt without passing the maximum', () => {
    assert.deepEqual(simulateResult('fail', strict, { used: 1, max: 3 }).attempts, {
      used: 2,
      max: 3,
    })
    assert.deepEqual(simulateResult('fail', strict, { used: 3, max: 3 }).attempts, {
      used: 3,
      max: 3,
    })
  })

  it('never claims the course was completed or synced', () => {
    for (const outcome of OUTCOMES)
      assert.equal(simulateResult(outcome, strict, attempts).sync.state, 'not_required')
  })

  for (const outcome of OUTCOMES)
    it(`a ${outcome} result satisfies the spec's Result schema`, () => {
      const schema = responseSchema('POST', '/trainer/attempts/{attempt_id}/submit', 200)
      assert.deepEqual(check(simulateResult(outcome, strict, attempts), schema, 'result'), [])
    })
})

describe('the congratulations', () => {
  const copy = esAssessment.result.congrats
  it('says the real percent and the threshold, strictly above or at least', () => {
    assert.equal(
      copy.check_in('92.00', 80, true),
      '¡Felicidades! Completaste la evaluación diagnóstica con 92.00 %, más del 80 % que se pide.'
    )
    assert.match(copy.check_in('80.00', 80, false), /al menos del 80 %/)
  })

  it('names the final exam for the final', () => {
    assert.match(copy.final('92.00', 80, true), /Aprobaste la evaluación final/)
    assert.doesNotMatch(copy.final('92.00', 80, true), /diagnóstica/)
  })
})
