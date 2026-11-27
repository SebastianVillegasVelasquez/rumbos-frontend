import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { es } from '../../i18n/es.ts'
import { esCongratulations } from '../../i18n/congratulations.es.ts'
import { describeIssue, tabFor, toIssues } from './editor/settingsIssues.ts'
import { exhaustedText, failureText, routeInstructionsText } from './journeyTexts.ts'

const copy = esCongratulations.journey
const values = { attempt: 1, max: 3, threshold: 80 }

describe('the journey texts without the author’s own', () => {
  it('are Rumbos’ copy, for a map with nulls and for one without the keys', () => {
    for (const settings of [
      null,
      {},
      { failure: null, exhausted: null, routeInstructions: null },
    ]) {
      assert.deepEqual(routeInstructionsText(settings), {
        title: copy.routeTitle,
        body: copy.routeBody,
        ctaLabel: copy.routeCta,
      })
      assert.deepEqual(exhaustedText(settings), {
        title: copy.exhaustedTitle,
        body: copy.exhaustedBody,
        ctaLabel: copy.exhaustedCta,
      })
      assert.deepEqual(failureText(settings, values), {
        title: copy.failureTitle(1, 3),
        body: copy.failureBody(2, 3),
        ctaLabel: '',
      })
    }
  })
  it('after the last attempt say what the exhausted screen says', () => {
    assert.equal(failureText(null, { ...values, attempt: 3 }).body, copy.exhaustedBody)
    const own = { exhausted: { body: 'Habla con tu tutor.' } }
    assert.equal(failureText(own, { ...values, attempt: 3 }).body, 'Habla con tu tutor.')
  })
})

describe('the author’s journey texts', () => {
  it('stand in field by field', () => {
    const shown = routeInstructionsText({ routeInstructions: { body: 'Recorre el mapa.' } })
    assert.deepEqual(shown, {
      title: copy.routeTitle,
      body: 'Recorre el mapa.',
      ctaLabel: copy.routeCta,
    })
  })
  it('fill the failure placeholders', () => {
    const shown = failureText(
      {
        failure: {
          title: 'Intento {attempt} de {attempts_max}',
          body: 'Te quedan {attempts_left}. Mínimo: {threshold}.',
          ctaLabel: 'Volver',
        },
      },
      values
    )
    assert.deepEqual(shown, {
      title: 'Intento 1 de 3',
      body: 'Te quedan 2. Mínimo: 80.',
      ctaLabel: 'Volver',
    })
  })
  it('never count fewer than no attempt left', () => {
    const settings = { failure: { body: 'Quedan {attempts_left}' } }
    assert.equal(failureText(settings, { ...values, attempt: 4 }).body, 'Quedan 0')
  })
  it('give way to the default where a value is unknown, never leaving a hole', () => {
    const settings = { failure: { title: 'Casi', body: 'Mínimo: {threshold}.' } }
    const shown = failureText(settings, { ...values, threshold: null })
    assert.equal(shown.title, 'Casi')
    assert.equal(shown.body, copy.failureBody(2, 3))
  })
  it('replace nothing in the blocks that take no placeholder', () => {
    assert.equal(exhaustedText({ exhausted: { body: '{threshold}' } }).body, '{threshold}')
  })
  it('stay text: markup comes out as written', () => {
    const attack = '<img src=x onerror=alert(1)>'
    assert.equal(routeInstructionsText({ routeInstructions: { body: attack } }).body, attack)
  })
})

describe('a refused journey text', () => {
  const issues = es.studio.training.issues
  // The backend's keys, with both spellings of the path.
  const cases = [
    ['failure.body', 'journey_text_placeholder_unknown'],
    ['exhausted.title', 'journey_text_too_long'],
    ['route_instructions.cta_label', 'journey_text_markup_not_allowed'],
    ['routeInstructions.ctaLabel', 'journey_text_markup_not_allowed'],
    ['congratulations.final.body', 'congratulations_placeholder_unknown'],
  ] as const
  it('is said in Spanish, on the tab that holds the field', () => {
    for (const [path, rule] of cases) {
      const [issue] = toIssues([{ path, rule, message_key: `trainer_settings.${rule}` }])
      assert.ok(issue)
      assert.equal(tabFor(issue.path), 'training', path)
      const said = describeIssue(issue, issues)
      assert.ok(said.includes(issues.messages[rule]!), said)
      assert.doesNotMatch(said, /journey_text|congratulations_|Configuración/)
    }
  })
  it('points at the field the editor renders', () => {
    const [issue] = toIssues([
      { path: 'route_instructions.cta_label', rule: 'x', message_key: 'x' },
    ])
    assert.equal(issue?.path, 'routeInstructions.ctaLabel')
  })
})
