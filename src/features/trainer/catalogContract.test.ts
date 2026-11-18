import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ContractError } from '../course-map/data/contract.ts'
import { hasContent, parseCatalog } from './catalogContract.ts'

const lesson = {
  id: '1.1',
  code: '1.1',
  title: 'Greetings',
  activities: [
    { id: 'en-a1-1.1-dialogue', skill: 'dialogue', title: 'Hello', state: 'not_started' },
  ],
}
// The answer the production backend sends, trimmed to the fields that matter here.
const real = (lessons: unknown[]) => ({
  enabled: true,
  language: 'en',
  level: 'A1',
  title: 'Inglés A1 · Turismo',
  content_version: 'cd21235a2e5ee4e4',
  modules: [{ key: 'M1', title: 'Asking for and giving personal information', lessons }],
})

const issuesOf = (value: unknown) => {
  try {
    parseCatalog(value)
  } catch (error) {
    assert.ok(error instanceof ContractError, 'a ContractError, never a TypeError')
    return error.issues
  }
  assert.fail('expected a ContractError')
}

describe('parseCatalog', () => {
  it('(a) accepts a map without a trainer, with nothing else on it', () => {
    const catalog = parseCatalog({ enabled: false, reason: 'disabled_for_map' })
    assert.equal(catalog.enabled, false)
    assert.equal(catalog.reason, 'disabled_for_map')
  })

  it('(b) accepts a trainer with no published content', () => {
    const catalog = parseCatalog({ enabled: false, reason: 'no_published_content', preview: true })
    assert.equal(catalog.reason, 'no_published_content')
    assert.equal(catalog.preview, true)
  })

  it('(c) accepts an enabled catalog whose lessons are empty, and says it has no content', () => {
    const catalog = parseCatalog(real([]))
    assert.equal(catalog.enabled, true)
    assert.equal(hasContent(catalog), false)
  })

  it('accepts the catalog the backend sends, and finds its nested lessons', () => {
    const catalog = parseCatalog(real([lesson]))
    assert.equal(hasContent(catalog), true)
    // The language arrives as a code; the screens read an object.
    assert.deepEqual(catalog.language, { code: 'en', name: '' })
  })

  it('accepts the flat form the mock server sends', () => {
    const catalog = parseCatalog({
      enabled: true,
      language: { code: 'en', name: 'inglés' },
      modules: [{ key: 'M1', title: 'M' }],
      lessons: [{ id: 'les1' }],
      activities: [],
    })
    assert.equal(catalog.language?.name, 'inglés')
    assert.equal(hasContent(catalog), true)
  })

  it('refuses an enabled catalog without modules, naming the field', () => {
    assert.deepEqual(issuesOf({ enabled: true }), ['modules: expected an array, got undefined'])
  })

  it('refuses modules that are not a list, lack their key, or hold a lesson without id', () => {
    assert.deepEqual(issuesOf({ enabled: true, modules: {} }), [
      'modules: expected an array, got object',
    ])
    assert.deepEqual(issuesOf({ enabled: true, modules: [{ title: 'x' }] }), [
      'modules[0].key: expected a string, got undefined',
    ])
    assert.deepEqual(issuesOf(real([{ code: 'x' }])), [
      'modules[0].lessons[0].id: expected a string, got undefined',
      'modules[0].lessons[0].title: expected a string, got undefined',
    ])
  })

  it('refuses a body that is not an object, and a missing or mistyped enabled', () => {
    assert.deepEqual(issuesOf(null), ['body: expected an object, got null'])
    assert.deepEqual(issuesOf([]), ['body: expected an object, got array'])
    assert.deepEqual(issuesOf({ modules: [] }), ['enabled: expected a boolean, got undefined'])
    assert.deepEqual(issuesOf({ enabled: 'yes' }), ['enabled: expected a boolean, got string'])
  })

  it('reports every wrong field in one error', () => {
    const found = issuesOf({ enabled: true, modules: [], lessons: 3, activities: 'x', skills: {} })
    assert.equal(found.length, 3)
  })
})
