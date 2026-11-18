import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { es } from '../../../i18n/es.ts'
import { ApiError } from '../../course-map/data/apiError.ts'
import type { MapSettings, WelcomeStep } from '../../course-map/data/types.ts'
import { describeSaveFailure } from '../../course-map/components/appearanceErrors.ts'
import {
  checkTrainingSettings,
  describeIssue,
  describeWarning,
  issuesFromError,
  normalizePath,
  pathCandidates,
  pruneIssues,
  tabFor,
  warningsOf,
} from './settingsIssues.ts'
import { setPolicy, setRules } from './trainingForm.ts'

const copy = es.studio.training.issues

const base = (extra: Partial<MapSettings> = {}): MapSettings => ({
  schemaVersion: 1,
  mode: 'explorative',
  fit: 'contain',
  initialView: null,
  path: { visible: true, style: 'dashed', color: null, animated: false },
  ambient: { kind: 'none', intensity: 0 },
  intro: 'none',
  ...extra,
})

const checkIn: WelcomeStep = {
  key: 'abc123',
  title: 'Evaluación de entrada',
  mandatory: true,
  revision: 1,
  type: 'assessment',
  purpose: 'check_in',
}

const failure = (errors: unknown) =>
  new ApiError(422, {
    detail: { code: 'trainer_settings_invalid', message: 'invalid', errors },
  })

describe('reading the server answer', () => {
  it('turns errors[] of a 422 into issues', () => {
    const issues = issuesFromError(
      failure([
        { path: 'assessments.checkIn.formId', rule: 'exists', message_key: 'form_not_found' },
      ])
    )
    assert.deepEqual(issues, [
      { path: 'assessments.checkIn.formId', rule: 'exists', messageKey: 'form_not_found' },
    ])
  })

  it('answers null for anything that is not a field-level 422', () => {
    assert.equal(issuesFromError(new Error('x')), null)
    assert.equal(issuesFromError(new ApiError(500, { detail: { code: 'x', message: 'y' } })), null)
    // Old backend: a 422 without errors[] keeps the one-line description.
    assert.equal(
      issuesFromError(
        new ApiError(422, { detail: { code: 'trainer_settings_invalid', message: 'm' } })
      ),
      null
    )
    assert.equal(issuesFromError(failure([{ nope: true }, 3, null])), null)
  })

  it('accepts the path spellings the editor does not use', () => {
    assert.equal(normalizePath('settings.assessments.enabled'), 'assessments.enabled')
    assert.equal(normalizePath('body.settings.welcome.steps.2.purpose'), 'welcome.steps[2].purpose')
    // A server that names the fields in snake_case points at the same controls.
    assert.equal(
      normalizePath('settings.assessments.check_in.form_id'),
      'assessments.checkIn.formId'
    )
    assert.equal(normalizePath('assessments.pass_percent'), 'assessments.passPercent')
  })

  it('reads warnings from a successful save, and none from an old backend', () => {
    assert.deepEqual(
      warningsOf({
        warnings: [{ path: 'trainer', rule: 'content', message_key: 'content_unpublished' }],
      }),
      [{ path: 'trainer', rule: 'content', messageKey: 'content_unpublished' }]
    )
    assert.deepEqual(warningsOf({}), [])
    assert.deepEqual(warningsOf(null), [])
  })

  it('keeps the old one-line text for a 422 it cannot list', () => {
    const text = describeSaveFailure(
      new ApiError(422, { detail: { code: 'trainer_settings_invalid', message: 'm' } }),
      es.studio.saveFailure
    )
    assert.match(text, /422, trainer_settings_invalid/)
  })
})

describe('saying it in words', () => {
  it('names the section and the problem, like the brief', () => {
    const [issue] = issuesFromError(
      failure([
        { path: 'assessments.checkIn.formId', rule: 'exists', message_key: 'form_not_found' },
      ])
    )!
    assert.equal(
      describeIssue(issue, copy),
      'Evaluación de entrada: el formulario seleccionado no existe'
    )
  })

  it('labels a welcome step by its position and title', () => {
    const issue = { path: 'welcome.steps[1].purpose', rule: 'r', messageKey: 'step_field_invalid' }
    assert.equal(
      describeIssue(issue, copy, (index) => (index === 1 ? 'Mi evaluación' : undefined)),
      'Paso 2 de la bienvenida (Mi evaluación): este paso no es válido'
    )
  })

  it('shows an unknown key with the key, never hides it', () => {
    const issue = { path: 'assessments.final.formId', rule: 'r', messageKey: 'brand_new_rule' }
    assert.equal(describeIssue(issue, copy), 'Evaluación final: revisa este valor (brand_new_rule)')
  })

  it('says a known warning as its own sentence', () => {
    const warning = { path: 'trainer', rule: 'r', messageKey: 'content_unpublished' }
    assert.equal(
      describeWarning(warning, copy),
      'El contenido aún no está publicado: los estudiantes no lo verán.'
    )
    const other = { path: 'trainer.level', rule: 'r', messageKey: 'level_without_content' }
    assert.equal(
      describeWarning(other, copy),
      'Entrenamiento: ese nivel todavía no tiene contenido'
    )
  })

  it('has a sentence for every key the editor itself can produce', () => {
    for (const issue of checkTrainingSettings(
      base({
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
    ))
      assert.ok(copy.messages[issue.messageKey], issue.messageKey)
  })
})

describe('where an issue points', () => {
  it('tries the field, then each enclosing one', () => {
    assert.deepEqual(pathCandidates('assessments.checkIn.formId'), [
      'assessments.checkIn.formId',
      'assessments.checkIn',
      'assessments',
    ])
    assert.deepEqual(pathCandidates('welcome.steps[2].purpose'), [
      'welcome.steps[2].purpose',
      'welcome.steps[2]',
      'welcome.steps',
      'welcome',
    ])
  })

  it('sends each path to its tab', () => {
    assert.equal(tabFor('assessments.enabled'), 'training')
    assert.equal(tabFor('trainer.level'), 'training')
    assert.equal(tabFor('welcome.steps[0]'), 'welcome')
    assert.equal(tabFor('mode'), null)
  })
})

describe('checking before the request', () => {
  const welcome = (steps: WelcomeStep[]) => ({
    enabled: true,
    title: null,
    message: null,
    video: null,
    playOnEnter: null,
    show: 'first_visit' as const,
    steps,
  })

  it('refuses a check-in step while the assessments are off, and asks for the form', () => {
    const issues = checkTrainingSettings(base({ welcome: welcome([checkIn]) }))
    assert.deepEqual(
      issues.map((issue) => [issue.path, issue.messageKey]),
      [
        ['assessments.enabled', 'assessments_disabled'],
        ['assessments.checkIn.formId', 'form_required'],
      ]
    )
  })

  it('accepts a check-in step once they are on and each form is chosen', () => {
    const on = setPolicy(base({ welcome: welcome([checkIn]) }), { enabled: true })
    const chosen = setRules(setRules(on, 'check_in', { formId: 'a1-form-a' }), 'final', {
      formId: 'a1-form-a',
    })
    assert.deepEqual(checkTrainingSettings(chosen), [])
  })

  it('never picks a form for the author: switched on without one, both are asked for', () => {
    const issues = checkTrainingSettings(setPolicy(base(), { enabled: true }))
    assert.deepEqual(
      issues.map((issue) => [issue.path, issue.messageKey]),
      [
        ['assessments.checkIn.formId', 'form_required'],
        ['assessments.final.formId', 'form_required'],
      ]
    )
  })

  it('has nothing to say about a map that does not use them', () => {
    assert.deepEqual(checkTrainingSettings(base()), [])
    assert.deepEqual(checkTrainingSettings(base({ welcome: welcome([]) })), [])
  })
})

describe('keeping the list honest', () => {
  it('drops the error of a field the author changed and keeps the rest', () => {
    const before = setPolicy(base(), { enabled: true })
    const after = setPolicy(before, { passPercent: 70 })
    const issues = [
      { path: 'assessments.passPercent', rule: 'r', messageKey: 'pass_percent_out_of_range' },
      { path: 'assessments.checkIn.formId', rule: 'r', messageKey: 'form_not_found' },
    ]
    assert.deepEqual(
      pruneIssues(issues, before, after).map((issue) => issue.path),
      ['assessments.checkIn.formId']
    )
  })

  it('keeps everything when nothing the list names changed', () => {
    const settings = setPolicy(base(), { enabled: true })
    const issues = [{ path: 'welcome.steps[0]', rule: 'r', messageKey: 'x' }]
    assert.equal(pruneIssues(issues, settings, settings).length, 1)
  })
})
