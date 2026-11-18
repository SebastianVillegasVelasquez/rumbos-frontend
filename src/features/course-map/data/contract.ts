// A response that does not have the shape the client was written for. It is its own
// error, apart from ApiError (which is the server saying no): the server said yes and
// sent something the screens cannot use. Raised at the API client, before the data
// reaches state, a cache or a render, so a wrong shape never turns into a TypeError
// somewhere deep in a component. Kept free of the build environment, like apiError.ts,
// so pure modules and their tests can use it.

export class ContractError extends Error {
  readonly endpoint: string
  readonly issues: readonly string[]

  constructor(endpoint: string, issues: readonly string[]) {
    super(`Unexpected response from ${endpoint}: ${issues.join('; ')}`)
    this.name = 'ContractError'
    this.endpoint = endpoint
    this.issues = issues
  }
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

// What a value is, for an issue that says what arrived.
export const kindOf = (value: unknown): string =>
  value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value

// Collects what is wrong with a response, field by field, so one error names all of it.
export class Issues {
  readonly list: string[] = []

  add(path: string, expected: string, got: unknown) {
    this.list.push(`${path}: expected ${expected}, got ${kindOf(got)}`)
  }

  string(path: string, value: unknown) {
    if (typeof value !== 'string') this.add(path, 'a string', value)
  }

  number(path: string, value: unknown) {
    if (typeof value !== 'number' || !Number.isFinite(value)) this.add(path, 'a number', value)
  }

  boolean(path: string, value: unknown) {
    if (typeof value !== 'boolean') this.add(path, 'a boolean', value)
  }

  // Absent is fine; present with another type is not.
  optional(path: string, value: unknown, check: (path: string, value: unknown) => void) {
    if (value !== undefined && value !== null) check(path, value)
  }

  // The array itself, then each element; the elements are checked by `each`.
  array(path: string, value: unknown, each?: (path: string, item: unknown) => void) {
    if (!Array.isArray(value)) return this.add(path, 'an array', value)
    if (each) value.forEach((item, index) => each(`${path}[${index}]`, item))
  }

  record(path: string, value: unknown): value is Record<string, unknown> {
    if (isRecord(value)) return true
    this.add(path, 'an object', value)
    return false
  }

  // Throws one ContractError carrying every issue, or returns when there are none.
  settle(endpoint: string): void {
    if (this.list.length > 0) throw new ContractError(endpoint, this.list)
  }
}

// Runs a parser over a response and records the cause when it refuses: the console
// says which endpoint and which fields, because the screen only says "try again".
export const checked =
  <T>(endpoint: string, parse: (value: unknown, endpoint: string) => T) =>
  (value: unknown): T => {
    try {
      return parse(value, endpoint)
    } catch (error) {
      if (error instanceof ContractError)
        console.error(`Contract violation at ${endpoint}`, error.issues)
      throw error
    }
  }
