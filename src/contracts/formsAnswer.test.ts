import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseForms } from '../features/assessment/editor/forms.ts'
import { check, responseSchema } from './openapiSchema.ts'

// The forms list the picker is written for, against the schema of its answer.
describe('GET /trainer/assessments/forms against openapi.json', () => {
  const answer = [
    { id: 'a1-form-a', title: 'A1 Forma A', publication_state: 'published' },
    { id: 'a1-form-b', title: 'A1 Forma B', publication_state: 'draft' },
  ]

  it('an answer the front reads satisfies the schema, and the other way round', () => {
    const schema = responseSchema('GET', '/trainer/assessments/forms')
    assert.deepEqual(check(answer, schema, 'forms'), [])
    assert.deepEqual(parseForms(answer), answer)
  })

  it('an answer with a field the spec does not have is reported', () => {
    const schema = responseSchema('GET', '/trainer/assessments/forms')
    assert.deepEqual(check([{ ...answer[0], locked: true }], schema, 'forms'), [
      'forms[0].locked: not in the schema',
    ])
  })
})
