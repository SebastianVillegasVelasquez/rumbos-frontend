import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { defaultAssessments } from '../../assessment/editor/trainingForm.ts'
import { trainerSettingsErrors, trainerSettingsWarnings } from './mockTrainerSettings.ts'
import type { MapSettings, WelcomeStep } from './types.ts'

const base = { schemaVersion: 1 } as unknown as MapSettings
const checkIn: WelcomeStep = {
  key: 'abc123',
  title: 'Entrada',
  mandatory: true,
  revision: 1,
  type: 'assessment',
  purpose: 'check_in',
}
const withStep = (assessments: MapSettings['assessments']): MapSettings => ({
  ...base,
  assessments,
  welcome: {
    enabled: true,
    title: null,
    message: null,
    video: null,
    playOnEnter: null,
    show: 'first_visit',
    steps: [checkIn],
  },
})

describe('the mock backend trainer rules', () => {
  it('refuses a check-in step while the assessments are off, with the step as the path', () => {
    assert.deepEqual(trainerSettingsErrors(withStep(null)), [
      {
        path: 'welcome.steps[0]',
        rule: 'check_in_requires_assessments',
        message_key: 'assessment_step_needs_check_in',
      },
    ])
  })

  it('refuses a form that does not exist, per purpose', () => {
    const assessments = defaultAssessments()
    assessments.enabled = true
    assessments.checkIn.formId = 'a1-form-a'
    assessments.final.formId = 'nope'
    assert.deepEqual(trainerSettingsErrors(withStep(assessments)), [
      { path: 'assessments.final.formId', rule: 'form_exists', message_key: 'form_not_found' },
    ])
  })

  it('requires a form for each purpose: none is chosen for the author', () => {
    const assessments = { ...defaultAssessments(), enabled: true }
    assert.deepEqual(
      trainerSettingsErrors(withStep(assessments)).map((issue) => [issue.path, issue.message_key]),
      [
        ['assessments.checkIn.formId', 'form_required'],
        ['assessments.final.formId', 'form_required'],
      ]
    )
  })

  it('accepts a chosen form, and refuses it when it is gone', () => {
    const assessments = { ...defaultAssessments(), enabled: true }
    assessments.checkIn.formId = 'a1-form-a'
    assessments.final.formId = 'a1-form-a'
    assert.deepEqual(trainerSettingsErrors(withStep(assessments)), [])
    assert.equal(trainerSettingsErrors(withStep(assessments), true).length, 2)
  })

  it('warns only when asked to and something is switched on', () => {
    const on = { ...base, trainer: { enabled: true, language: 'en', level: 'A1' } } as MapSettings
    assert.equal(trainerSettingsWarnings(on, true).length, 1)
    assert.equal(trainerSettingsWarnings(on, false).length, 0)
    assert.equal(trainerSettingsWarnings(base, true).length, 0)
  })
})
