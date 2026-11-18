import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { MapSettings } from '../../course-map/data/types.ts'
import {
  assessmentsOf,
  clamp,
  defaultAssessments,
  defaultTrainer,
  enableAssessments,
  levelHasContent,
  setPolicy,
  setRules,
  setTrainer,
  trainerOf,
  trainingSupported,
} from './trainingForm.ts'

const base = { schemaVersion: 1 } as unknown as MapSettings

describe('training settings model', () => {
  it('fills the parts a partial server object leaves out', () => {
    const partial = {
      ...base,
      assessments: { enabled: true },
      trainer: {},
    } as unknown as MapSettings
    const a = assessmentsOf(partial)
    assert.equal(a.enabled, true)
    assert.equal(a.check_in.max_attempts, 1)
    assert.equal(a.final.max_attempts, 3)
    assert.equal(a.exemption.enabled, true)
    assert.equal(trainerOf(partial).level, 'A1')
  })

  it('both features default off, with the agreed policy', () => {
    assert.equal(defaultTrainer().enabled, false)
    const a = defaultAssessments()
    assert.equal(a.enabled, false)
    assert.equal(a.check_in.max_attempts, 1)
    assert.equal(a.final.max_attempts, 3)
    assert.equal(a.check_in.time_limit_min, 60)
    assert.equal(a.pass_percent, 80)
    assert.equal(a.pass_operator, 'gt')
    assert.equal(a.exemption.enabled, true)
  })

  it('reads missing settings as the defaults', () => {
    assert.deepEqual(trainerOf(base), defaultTrainer())
    assert.deepEqual(assessmentsOf(base), defaultAssessments())
  })

  it('clamps typed values so the settings are never invalid', () => {
    assert.equal(clamp(500, 5, 240), 240)
    assert.equal(clamp(-3, 5, 240), 5)
    assert.equal(clamp(Number.NaN, 5, 240), 5)
    assert.equal(clamp(59.6, 5, 240), 60)
    const s = setRules(base, 'final', { max_attempts: 99, time_limit_min: 1 })
    assert.equal(s.assessments?.final.max_attempts, 10)
    assert.equal(s.assessments?.final.time_limit_min, 5)
    assert.equal(setPolicy(base, { pass_percent: 140 }).assessments?.pass_percent, 100)
  })

  it('keeps the other purpose and the form when one changes', () => {
    const s = setRules(base, 'check_in', { max_attempts: 2 })
    assert.equal(s.assessments?.final.max_attempts, 3)
    assert.equal(s.assessments?.check_in.form_id, defaultAssessments().check_in.form_id)
  })

  it('only a level with content can be chosen', () => {
    assert.equal(levelHasContent('en', 'A1'), true)
    assert.equal(levelHasContent('en', 'B2'), false)
    assert.equal(setTrainer(base, { level: 'B2' }).trainer?.level, 'A1')
    assert.equal(setTrainer(base, { enabled: true }).trainer?.enabled, true)
  })

  it('the exemption switch and the operator are saved as chosen', () => {
    const s = setPolicy(base, { exemption: false, pass_operator: 'gte', enabled: true })
    assert.equal(s.assessments?.exemption.enabled, false)
    assert.equal(s.assessments?.pass_operator, 'gte')
    assert.equal(s.assessments?.enabled, true)
  })

  it('is offered only where the backend knows the feature', () => {
    assert.equal(trainingSupported(base), false)
    assert.equal(trainingSupported({ ...base, trainer: null }), true)
  })

  it('keeps the form id as typed, up to its limit, and per purpose', () => {
    const typed = setRules(base, 'check_in', { form_id: ' forma_b ' })
    assert.equal(typed.assessments?.check_in.form_id, ' forma_b ')
    assert.equal(typed.assessments?.final.form_id, 'forma_a')
    assert.equal(
      setRules(base, 'final', { form_id: 'x'.repeat(200) }).assessments?.final.form_id.length,
      64
    )
  })

  it('turns the assessments on for the check-in step without touching the rules', () => {
    const tuned = setRules(base, 'check_in', { max_attempts: 4 })
    const on = enableAssessments(tuned)
    assert.equal(on.assessments?.enabled, true)
    assert.equal(on.assessments?.check_in.max_attempts, 4)
    // Already on: nothing to change.
    assert.equal(enableAssessments(on), on)
  })
})
