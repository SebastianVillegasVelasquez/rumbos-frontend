import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ContractError } from '../../course-map/data/contract.ts'
import { parseForms } from './forms.ts'

describe('the forms an editor can pick', () => {
  it('reads the list as the backend sends it, drafts included', () => {
    const list = [
      { id: 'a1-form-a', title: 'A1 Forma A', publication_state: 'published' },
      { id: 'a1-form-b', title: 'A1 Forma B', publication_state: 'draft' },
    ]
    assert.deepEqual(parseForms(list), list)
    assert.deepEqual(parseForms([]), [])
  })

  it('refuses a list it cannot read, naming the endpoint and the fields', () => {
    for (const body of [null, {}, { items: [] }, 'x'])
      assert.throws(() => parseForms(body), ContractError)
    try {
      parseForms([{ id: 'a', title: 3, publication_state: 'archived' }])
      assert.fail('expected a ContractError')
    } catch (error) {
      assert.ok(error instanceof ContractError)
      assert.equal(error.endpoint, 'GET /trainer/assessments/forms')
      assert.deepEqual(error.issues, [
        '[0].title: expected a string, got number',
        '[0].publication_state: expected one of draft, reviewed, published, got archived',
      ])
    }
  })

  it('never falls back to a form of its own', () => {
    assert.throws(() => parseForms(undefined), ContractError)
  })
})
