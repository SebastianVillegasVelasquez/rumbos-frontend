// The exam never receives keys, accepted answers, rubrics or per-item
// correctness (three attempts on one form would leak the key). The server must
// not send them; this is the client's second lock: a response that carries any
// such field is refused whole, so nothing of it can be stored or shown.

const FORBIDDEN =
  /^(is_?)?(correct|right|wrong)(_?(answers?|options?|option_id|ids?|ness))?$|^(answer_?keys?|accepted(_?answers?)?|solutions?|rubrics?|expected(_?answers?)?|closest_?answer|explanation|error_?tags?|item_?scores?|per_?item)$/i

// The path of the first forbidden key, or null when the value is clean.
export const findLeak = (value: unknown, path = ''): string | null => {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const found = findLeak(value[i], `${path}[${i}]`)
      if (found) return found
    }
    return null
  }
  if (typeof value !== 'object' || value === null) return null
  for (const [key, inner] of Object.entries(value)) {
    if (FORBIDDEN.test(key)) return `${path}.${key}`
    const found = findLeak(inner, `${path}.${key}`)
    if (found) return found
  }
  return null
}

export class AssessmentLeakError extends Error {
  readonly path: string
  constructor(path: string) {
    super(`assessment response carries a forbidden field at ${path}`)
    this.name = 'AssessmentLeakError'
    this.path = path
  }
}

export const refuseLeak = <T>(value: T): T => {
  const path = findLeak(value)
  if (path) throw new AssessmentLeakError(path)
  return value
}
