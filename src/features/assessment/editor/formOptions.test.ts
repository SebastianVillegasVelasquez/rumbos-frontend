import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { es } from '../../../i18n/es.ts'
import { formOptionLabel, groupForms, sortForms } from './formOptions.ts'
import { parseForms, type AssessmentForm } from './forms.ts'
import { describeIssue, issueMessage } from './settingsIssues.ts'

const form = (over: Partial<AssessmentForm>): AssessmentForm => ({
  id: 'x',
  title: 'Forma A',
  language: 'en',
  level: 'A1',
  purpose: 'check_in',
  publication_state: 'published',
  ...over,
})
const a1 = form({ id: 'a1-form-a', level: 'A1' })
const a2 = form({ id: 'a2-form-a', level: 'A2', publication_state: 'draft' })

describe('the exam form picker', () => {
  it('tells two forms with the same title apart by level and purpose', () => {
    assert.equal(a1.title, a2.title)
    assert.equal(formOptionLabel(a1), 'A1 · Evaluación de entrada — Forma A')
    assert.equal(formOptionLabel(a2), 'A2 · Evaluación de entrada — Forma A (borrador)')
    assert.notEqual(formOptionLabel(a1), formOptionLabel(a2))
  })

  it('puts the purpose in the label of a final form too', () => {
    assert.match(formOptionLabel(form({ purpose: 'final' })), /^A1 · Evaluación final — /)
  })

  it('lists a form of an older backend by its title, without breaking', () => {
    const old = parseForms([{ id: 'a', title: 'Forma A', publication_state: 'published' }])
    assert.equal(formOptionLabel(old[0]), 'Forma A')
  })

  it('refuses a purpose that is not in the contract', () => {
    assert.throws(() => parseForms([{ ...a1, purpose: 'midterm' }]))
  })

  it('sorts by language, then level, whatever order the API used', () => {
    const b1 = form({ id: 'b1', level: 'B1' })
    assert.deepEqual(
      sortForms([b1, a2, a1]).map((f) => f.id),
      ['a1-form-a', 'a2-form-a', 'b1']
    )
  })

  it('puts the forms of the course level first and keeps the others choosable', () => {
    const groups = groupForms([a1, a2], { language: 'en', level: 'A2' })
    assert.deepEqual(
      groups.matching.map((f) => f.id),
      ['a2-form-a']
    )
    assert.deepEqual(
      groups.others.map((f) => f.id),
      ['a1-form-a']
    )
  })

  it('does not group when the trainer is off, or when a form has no level', () => {
    assert.equal(groupForms([a1, a2], null).others.length, 0)
    const old = form({ level: undefined, language: undefined })
    assert.deepEqual(groupForms([old], { language: 'en', level: 'A2' }).others, [])
  })
})

describe('the level mismatch the server refuses on save', () => {
  it('has its own Spanish message, never the raw code', () => {
    const issue = {
      path: 'assessments.checkIn.formId',
      rule: 'form_level_mismatch',
      messageKey: 'form_level_mismatch',
    }
    const copy = es.studio.training.issues
    assert.ok(copy.messages.form_level_mismatch)
    assert.equal(issueMessage(issue, copy), copy.messages.form_level_mismatch)
    assert.doesNotMatch(describeIssue(issue, copy), /form_level_mismatch/)
  })
})
