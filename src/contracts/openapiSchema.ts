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

export const deref = (node: Node): Node => {
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
// `allOf` read as one schema: the properties and required keys of every part, and the keys the
// outer schema adds (a `const` that narrows a part, for example) over the parts'.
const mergeAllOf = (schema: Node): Node => {
  const parts = ((schema.allOf ?? []) as Node[]).map((part) => mergeAllOf(deref(part)))
  const { allOf: _allOf, ...own } = schema
  void _allOf
  const properties: Record<string, Node> = {}
  const required = new Set<string>()
  for (const part of [...parts, own]) {
    Object.assign(properties, (part.properties ?? {}) as Record<string, Node>)
    for (const key of (part.required ?? []) as string[]) required.add(key)
  }
  const merged: Node = { ...Object.assign({}, ...parts), ...own, properties }
  if (required.size > 0) merged.required = [...required]
  return merged
}

export const check = (value: unknown, raw: Node, at: string): string[] => {
  let schema = deref(raw)
  if (schema.allOf) schema = mergeAllOf(schema)
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
  if (type === 'integer' || type === 'number') {
    if (!(typeof value === 'number' && (type === 'number' || Number.isInteger(value))))
      return [`${at}: expected ${type}, got ${actual}`]
    const { minimum, maximum, exclusiveMinimum, exclusiveMaximum } = schema as Record<
      string,
      number | undefined
    >
    if (minimum !== undefined && value < minimum) return [`${at}: ${value} is below ${minimum}`]
    if (maximum !== undefined && value > maximum) return [`${at}: ${value} is above ${maximum}`]
    if (exclusiveMinimum !== undefined && value <= exclusiveMinimum)
      return [`${at}: ${value} is not above ${exclusiveMinimum}`]
    if (exclusiveMaximum !== undefined && value >= exclusiveMaximum)
      return [`${at}: ${value} is not below ${exclusiveMaximum}`]
    return []
  }
  if (type === 'string' || type === 'boolean') {
    if (actual !== type) return [`${at}: expected ${type}, got ${actual}`]
    if (type === 'string') {
      const { minLength, maxLength, pattern } = schema as {
        minLength?: number
        maxLength?: number
        pattern?: string
      }
      const text = value as string
      if (minLength !== undefined && text.length < minLength)
        return [`${at}: shorter than ${minLength} characters`]
      if (maxLength !== undefined && text.length > maxLength)
        return [`${at}: longer than ${maxLength} characters`]
      if (pattern !== undefined && !new RegExp(pattern).test(text))
        return [`${at}: does not match ${pattern}`]
    }
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

// The schema of the answer of `METHOD /route` with `status` (200 unless said).
export const responseSchema = (method: string, route: string, status = 200): Node => {
  const answer = (operation(method, route)?.responses as Node | undefined)?.[String(status)] as
    Node | undefined
  return jsonSchema(answer, `the ${status} answer of ${method} /api/v1${route}`)
}

// The schema of the JSON body `METHOD /route` takes.
export const requestSchema = (method: string, route: string): Node =>
  jsonSchema(
    operation(method, route)?.requestBody as Node | undefined,
    `the body of ${method} /api/v1${route}`
  )
