import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { check, responseSchema, SPEC_PATH, specPresent } from '../../contracts/openapiSchema.ts'
import { catalogFixture } from './fixtures/catalogFixture.ts'
import { parseCatalog } from './catalogContract.ts'

// The real catalog answer against the backend's openapi.json: the fixture must satisfy
// the schema (required fields, types, enums, nothing undeclared) and the front must accept it.
// The spec and the checker are shared with the other contract tests (src/contracts).
const present = specPresent
const path = SPEC_PATH

const catalogSchema = () => responseSchema('GET', '/trainer/catalog')

describe('GET /trainer/catalog against openapi.json', () => {
  it('has the spec to compare with', () => {
    assert.ok(
      present,
      `openapi.json not found at ${path}: copy the backend export (contracts/README.md)`
    )
  })

  it('the real preview answer satisfies the schema', () => {
    assert.deepEqual(check(catalogFixture(), catalogSchema(), 'catalog'), [])
  })

  it('the two documented answers of a catalog that is off satisfy the schema', () => {
    for (const reason of ['disabled_for_map', 'no_published_content'])
      assert.deepEqual(
        check({ enabled: false, reason, preview: true }, catalogSchema(), 'catalog'),
        []
      )
  })

  it('the front accepts the real answer', () => {
    const activity = parseCatalog(catalogFixture()).modules?.[0]?.lessons[0]?.activities[0]
    assert.equal(activity?.publication_state, 'draft')
  })

  it('a fixture that drifts from the schema is reported', () => {
    const drifted = catalogFixture() as {
      modules: { lessons: { activities: Record<string, unknown>[] }[] }[]
    }
    const first = drifted.modules[0]?.lessons[0]?.activities[0]
    assert.ok(first)
    delete first.step_count
    first.publication_state = 'archived'
    first.locked = false
    assert.deepEqual(check(drifted, catalogSchema(), 'catalog').sort(), [
      'catalog.modules[0].lessons[0].activities[0].locked: not in the schema',
      'catalog.modules[0].lessons[0].activities[0].publication_state: archived is not in draft,reviewed,published',
      'catalog.modules[0].lessons[0].activities[0].step_count: required, missing',
    ])
  })
})
