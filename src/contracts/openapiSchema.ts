import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

// Shared by the contract tests: the committed backend spec and a checker that says what is
// wrong with a value against one of its schemas. The spec is contracts/openapi.json (see
// contracts/README.md); OPENAPI_JSON points at another one. A missing spec FAILS the suite:
// a contract test that skips itself in CI checks nothing.
export const SPEC_PATH = process.env.OPENAPI_JSON ?? 'contracts/openapi.json'

export type Node = Record<string, unknown>

export const specPresent = existsSync(SPEC_PATH)
export const spec = (specPresent ? JSON.parse(readFileSync(SPEC_PATH, 'utf8')) : {}) as Node

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
export const check = (value: unknown, raw: Node, at: string): string[] => {
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
    const open =
      schema.additionalProperties === true || typeof schema.additionalProperties === 'object'
    return [
      ...required.filter((key) => !(key in record)).map((key) => `${at}.${key}: required, missing`),
      // `additionalProperties: true` (free-form, e.g. an answer's `response`) or a schema
      // declares the open keys; the backend's strict models declare nothing here.
      ...Object.keys(record)
        .filter((key) => !(key in props) && !open)
        .map((key) => `${at}.${key}: not in the schema`),
      ...Object.entries(record).flatMap(([key, child]) =>
        key in props
          ? check(child, props[key] as Node, `${at}.${key}`)
          : typeof schema.additionalProperties === 'object'
            ? check(child, schema.additionalProperties as Node, `${at}.${key}`)
            : []
      ),
    ]
  }
  return []
}

const operation = (method: string, route: string): Node | undefined =>
  ((spec.paths as Record<string, Node> | undefined)?.[`/api/v1${route}`] as Node | undefined)?.[
    method.toLowerCase()
  ] as Node | undefined

// Whether the spec declares `METHOD /route` (route without /api/v1, with {param} as written).
export const hasOperation = (method: string, route: string): boolean =>
  operation(method, route) !== undefined

// Whether the spec declares a route for the request that was actually sent: `method` and the
// concrete `url` (e.g. /api/v1/trainer/sessions/3f2b/answers), each {param} matching one segment.
export const specServes = (method: string, url: string): boolean => {
  const pathname = url.split('?')[0] ?? url
  return Object.entries((spec.paths ?? {}) as Record<string, Node>).some(
    ([template, item]) =>
      method.toLowerCase() in item &&
      new RegExp(`^${template.replace(/\{[^}]+\}/g, '[^/]+')}$`).test(pathname)
  )
}

const jsonSchema = (holder: Node | undefined, what: string): Node => {
  const json = (holder?.content as Node | undefined)?.['application/json'] as Node | undefined
  assert.ok(json?.schema, `the spec has no JSON schema for ${what}`)
  return json.schema as Node
}

// The schema of the 200 answer of `METHOD /route`.
export const responseSchema = (method: string, route: string): Node => {
  const ok = (operation(method, route)?.responses as Node | undefined)?.['200'] as Node | undefined
  return jsonSchema(ok, `the 200 answer of ${method} /api/v1${route}`)
}

// The schema of the JSON body `METHOD /route` takes.
export const requestSchema = (method: string, route: string): Node =>
  jsonSchema(
    operation(method, route)?.requestBody as Node | undefined,
    `the body of ${method} /api/v1${route}`
  )
