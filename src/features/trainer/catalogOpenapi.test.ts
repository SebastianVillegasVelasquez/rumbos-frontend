import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { previewCatalog } from './fixtures/previewCatalog.ts'

// The catalog fixture against the backend's OpenAPI: every field of the fixture is in
// the schema, and every field the screens require is one the schema declares. Point
// OPENAPI_JSON at the spec (or put it at ./openapi.json, untracked). Without the file
// the suite is skipped, never failed.
const path = process.env.OPENAPI_JSON ?? 'openapi.json'
const present = existsSync(path)

type Node = Record<string, unknown>
const spec = (present ? JSON.parse(readFileSync(path, 'utf8')) : {}) as Node

const deref = (node: unknown): Node => {
  let current = node as Node
  for (let hops = 0; typeof current?.$ref === 'string' && hops < 20; hops++) {
    let target: unknown = spec
    for (const part of current.$ref.replace(/^#\//, '').split('/'))
      target = (target as Node)?.[part]
    current = target as Node
  }
  return current ?? {}
}

// Properties of an object schema, following $ref, allOf and the non-null side of anyOf.
const propsOf = (node: unknown): Record<string, unknown> => {
  const schema = deref(node)
  const found: Record<string, unknown> = { ...((schema.properties as Node) ?? {}) }
  for (const key of ['allOf', 'anyOf', 'oneOf'] as const)
    for (const part of (schema[key] as unknown[]) ?? []) Object.assign(found, propsOf(part))
  return found
}

const itemsOf = (node: unknown): unknown => {
  const schema = deref(node)
  if (schema.items) return schema.items
  for (const key of ['anyOf', 'oneOf', 'allOf'] as const)
    for (const part of (schema[key] as unknown[]) ?? []) {
      const items = itemsOf(part)
      if (items) return items
    }
  return undefined
}

const catalogSchema = (): unknown => {
  const get = ((spec.paths as Node)?.['/api/v1/trainer/catalog'] ??
    (spec.paths as Node)?.['/trainer/catalog']) as Node | undefined
  const ok = ((get?.get as Node)?.responses as Node)?.['200'] as Node | undefined
  return ((ok?.content as Node)?.['application/json'] as Node)?.schema
}

// Fields of `value` that the schema does not declare, by path.
const undeclared = (value: unknown, schema: unknown, at: string): string[] => {
  if (Array.isArray(value))
    return value.flatMap((item) => undeclared(item, itemsOf(schema), `${at}[]`))
  if (typeof value !== 'object' || value === null) return []
  const props = propsOf(schema)
  return Object.entries(value).flatMap(([key, child]) =>
    key in props ? undeclared(child, props[key], `${at}.${key}`) : [`${at}.${key}`]
  )
}

describe('GET /trainer/catalog against the OpenAPI', { skip: !present }, () => {
  it('declares every field of the preview fixture', () => {
    const schema = catalogSchema()
    assert.ok(schema, 'the spec has no 200 schema for GET /trainer/catalog')
    assert.deepEqual(undeclared(previewCatalog, schema, 'catalog'), [])
  })

  it('declares every field the screens require', () => {
    const modules = itemsOf(propsOf(catalogSchema()).modules)
    const lessons = itemsOf(propsOf(modules).lessons)
    const activities = itemsOf(propsOf(lessons).activities)
    const missing = [
      ...['key', 'title'].filter((f) => !(f in propsOf(modules))).map((f) => `module.${f}`),
      ...['id', 'title'].filter((f) => !(f in propsOf(lessons))).map((f) => `lesson.${f}`),
      ...['id', 'title', 'skill']
        .filter((f) => !(f in propsOf(activities)))
        .map((f) => `activity.${f}`),
    ]
    assert.deepEqual(missing, [])
  })
})
