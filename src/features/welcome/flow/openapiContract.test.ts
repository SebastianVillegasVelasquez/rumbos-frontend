import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

// Contract test against a local openapi.json. The backend of the welcome flow is
// built in parallel; when its spec is available, point OPENAPI_JSON at it (or put
// it at ./openapi.json, which is untracked) and this checks that the fields this
// feature relies on exist. Without the file the suite is skipped, never failed.
const path = process.env.OPENAPI_JSON ?? 'openapi.json'
const present = existsSync(path)

const load = () => JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>

// Every property name that appears anywhere in the schemas, and every enum value.
const collect = (node: unknown, names: Set<string>, values: Set<string>) => {
  if (Array.isArray(node)) {
    for (const item of node) {
      if (typeof item === 'string') values.add(item)
      else collect(item, names, values)
    }
    return
  }
  if (typeof node !== 'object' || node === null) return
  for (const [key, value] of Object.entries(node)) {
    if (key === 'properties' && typeof value === 'object' && value !== null)
      for (const name of Object.keys(value)) names.add(name)
    if (key === 'const' && typeof value === 'string') values.add(value)
    collect(value, names, values)
  }
}

describe('openapi.json contract for the welcome flow', { skip: !present }, () => {
  const spec = present ? load() : {}
  const names = new Set<string>()
  const values = new Set<string>()
  collect(spec, names, values)
  // Error codes are usually documented in descriptions and examples, not enums.
  const text = JSON.stringify(spec)

  it('the settings carry the steps and their fields', () => {
    for (const field of [
      'steps',
      'key',
      'mandatory',
      'revision',
      'buttonLabel',
      'allowFallback',
      'html',
      'css',
      'ack',
      'minSeconds',
      'assetId',
      'cmid',
      'intro',
      'outcomeAbove',
      'outcomeBelow',
    ])
      assert.ok(names.has(field), `property "${field}" is missing`)
  })

  it('the five step types exist', () => {
    for (const type of ['welcome', 'video', 'html', 'pdf', 'quiz'])
      assert.ok(values.has(type), `step type "${type}" is missing`)
  })

  it('documents: the asset kind and welcomeDocuments on the map reads', () => {
    assert.ok(values.has('document'), 'asset kind "document" is missing')
    for (const field of ['welcomeDocuments', 'pageCount', 'available'])
      assert.ok(names.has(field), `property "${field}" is missing`)
  })

  it('the error codes of the brief are described', () => {
    for (const code of [
      'welcome_invalid',
      'document_invalid',
      'document_rights_declaration_required',
      'legacy_fields_with_steps',
      'step_key_duplicate',
      'step_type_invalid',
      'welcome_step_position',
      'html_forbidden_markup',
      'css_forbidden',
      'document_unavailable',
      'steps_too_many',
      'flow_too_large',
      'video_invalid',
      'quiz_too_many',
    ])
      assert.ok(text.includes(code), `error code "${code}" is not in the spec`)
  })

  it('the import warnings are described', () => {
    for (const code of ['flow_quiz_unlinked', 'document_dropped'])
      assert.ok(text.includes(code), `warning "${code}" is not in the spec`)
  })
})
