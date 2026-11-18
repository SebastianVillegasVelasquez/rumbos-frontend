import { check, deref, responseSchema, type Node } from './openapiSchema.ts'

// Answers built from the backend's openapi.json, for the mocks: a valid body is made from
// the response schema (required fields, the first enum value, a fixed id for a uuid), then
// the mock overrides the fields it has opinions about, and the result is checked against the
// schema again. A mock that drifts from the contract therefore fails where it is written,
// not in whichever screen first reads the wrong field.

const UUID = '00000000-0000-4000-8000-000000000000'

const generate = (raw: Node): unknown => {
  const schema = deref(raw)
  const branches = (schema.anyOf ?? schema.oneOf) as Node[] | undefined
  if (branches) return generate(branches.find((b) => deref(b).type !== 'null') ?? branches[0]!)
  if ('const' in schema) return schema.const
  if ('default' in schema && schema.default !== undefined) return schema.default
  const enumValues = schema.enum as unknown[] | undefined
  if (enumValues) return enumValues[0]
  switch (schema.type) {
    case 'string':
      return schema.format === 'uuid'
        ? UUID
        : schema.format === 'date-time'
          ? '2026-01-01T00:00:00Z'
          : 'x'
    case 'integer':
    case 'number':
      return typeof schema.minimum === 'number' ? schema.minimum : 0
    case 'boolean':
      return false
    case 'array':
      return []
    case 'null':
      return null
    default: {
      const props = (schema.properties ?? {}) as Record<string, Node>
      const required = (schema.required ?? []) as string[]
      return Object.fromEntries(required.map((key) => [key, generate(props[key] as Node)]))
    }
  }
}

// What `METHOD /route` answers with `status`: generated from the spec, `overrides` on top
// (shallow: a field replaced whole), and checked. Throws when the result is not valid.
export const specReply = (
  method: string,
  route: string,
  status: number,
  overrides: Record<string, unknown> = {}
): unknown => {
  const schema = responseSchema(method, route, status)
  return validated(method, route, status, { ...(generate(schema) as object), ...overrides })
}

// `body` after checking it against the answer the spec declares for `METHOD /route`.
export const validated = (
  method: string,
  route: string,
  status: number,
  body: unknown
): unknown => {
  const problems = check(body, responseSchema(method, route, status), `${method} ${route}`)
  if (problems.length > 0)
    throw new Error(
      `The mock's ${status} answer to ${method} ${route} drifts from the spec:\n${problems.join('\n')}`
    )
  return body
}
