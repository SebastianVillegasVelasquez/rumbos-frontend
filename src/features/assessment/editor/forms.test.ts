import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { FALLBACK_FORMS, parseForms } from './forms.ts'

describe('the forms an author can pick', () => {
  it('reads a list in the shapes a backend may send', () => {
    const expected = [{ id: 'a1-form-a', title: 'A1 Forma A' }]
    assert.deepEqual(
      parseForms({ items: [{ form_id: 'a1-form-a', title: 'A1 Forma A' }] }),
      expected
    )
    assert.deepEqual(parseForms([{ id: 'a1-form-a', name: 'A1 Forma A' }]), expected)
    assert.deepEqual(parseForms({ forms: ['a1-form-a'] }), [
      { id: 'a1-form-a', title: 'a1-form-a' },
    ])
  })

  it('keeps a1-form-a as the only form until the list answers anything usable', () => {
    for (const body of [null, {}, [], { items: [] }, { items: [3, null] }, 'x'])
      assert.deepEqual(parseForms(body), [...FALLBACK_FORMS])
    assert.deepEqual(
      FALLBACK_FORMS.map((form) => form.id),
      ['a1-form-a']
    )
  })
})
