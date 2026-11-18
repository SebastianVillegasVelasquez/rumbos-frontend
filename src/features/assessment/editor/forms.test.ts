import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { KNOWN_FORMS } from './forms.ts'

describe('the forms an author can pick', () => {
  it('is a1-form-a, the only form known to exist', () => {
    assert.deepEqual(
      KNOWN_FORMS.map((form) => form.id),
      ['a1-form-a']
    )
  })
})
