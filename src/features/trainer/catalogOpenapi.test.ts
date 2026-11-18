import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { catalogFixture } from './fixtures/catalogFixture.ts'
import { parseCatalog } from './catalogContract.ts'

// The real catalog answer against the backend's openapi.json: the fixture must satisfy
// the schema (required fields, types, enums, nothing undeclared), and so must a catalog
// the front accepts. Point OPENAPI_JSON at the spec; otherwise ./openapi.json or the
// sibling ../rumbos-backend/openapi.json is used. Without any, the suite is skipped.
const path = [process.env.OPENAPI_JSON, 'openapi.json', '../rumbos-backend/openapi.json'].find(
  (candidate) => candidate && existsSync(candidate)
)

type Node = Record<string, unknown>
const spec = (path ? JSON.parse(readFileSync(path, 'utf8')) : {}) as Node

const deref = (node: Node): Node => {
  let current = node
  for (let hops = 0; typeof current.$ref === 'string' && hops < 20; hops++) {
    let target: unknown = spec
    for (const part of current.$ref.replace(/^#\//, '').split('/'))
      target = (target as Node)?.[part]
    current = (target as Node) ?? {}
  }
  return current
}

const kind = (value: unknown) =>
  value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value

// What is wrong with `value` against `schema`, by path. Empty when it conforms.
const check = (value: unknown, raw: Node, at: string): string[] => {
  const schema = deref(raw)
  const branches = (schema.anyOf ?? schema.oneOf) as Node[] | undefined
  if (branches) {
    const results = branches.map((branch) => check(value, branch, at))
    return results.some((r) => r.length === 0)
      ? []
      : (results.sort((a, b) => a.length - b.length)[0] ?? [])
  }
  const type = schema.type as string | undefined
  const actual = kind(value)
  if (type === 'null') return actual === 'null' ? [] : [`${at}: expected null, got ${actual}`]
  if (type === 'integer' || type === 'number')
    return typeof value === 'number' && (type === 'number' || Number.isInteger(value))
      ? []
      : [`${at}: expected ${type}, got ${actual}`]
  if (type === 'string' || type === 'boolean') {
    if (actual !== type) return [`${at}: expected ${type}, got ${actual}`]
    const allowed = schema.enum as unknown[] | undefined
    if (allowed && !allowed.includes(value)) return [`${at}: ${String(value)} is not in ${allowed}`]
    if ('const' in schema && schema.const !== value)
      return [`${at}: expected ${String(schema.const)}`]
    return []
  }
  if (type === 'array') {
    if (!Array.isArray(value)) return [`${at}: expected array, got ${actual}`]
    return value.flatMap((item, i) => check(item, schema.items as Node, `${at}[${i}]`))
  }
  if (type === 'object' || schema.properties) {
    if (actual !== 'object') return [`${at}: expected object, got ${actual}`]
    const record = value as Record<string, unknown>
    const props = (schema.properties ?? {}) as Record<string, Node>
    const required = (schema.required ?? []) as string[]
    return [
      ...required.filter((key) => !(key in record)).map((key) => `${at}.${key}: required, missing`),
      ...Object.keys(record)
        .filter((key) => !(key in props))
        .map((key) => `${at}.${key}: not in the schema`),
      ...Object.entries(record).flatMap(([key, child]) =>
        key in props ? check(child, props[key] as Node, `${at}.${key}`) : []
      ),
    ]
  }
  return []
}

const catalogSchema = (): Node => {
  const paths = spec.paths as Record<string, Node>
  const get = paths['/api/v1/trainer/catalog']?.get as Node | undefined
  const ok = (get?.responses as Node | undefined)?.['200'] as Node | undefined
  const json = (ok?.content as Node | undefined)?.['application/json'] as Node | undefined
  assert.ok(json?.schema, 'the spec has no 200 schema for GET /api/v1/trainer/catalog')
  return json.schema as Node
}

describe('GET /trainer/catalog against openapi.json', { skip: !path }, () => {
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
