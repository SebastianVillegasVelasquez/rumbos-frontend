import { ContractError, Issues, isRecord, kindOf } from '../course-map/data/contract.ts'
import type { Catalog } from './types.ts'

// The catalog as the screens will read it, checked at the edge. `enabled` decides what
// else must be there: a catalog that is off carries nothing but its reason (and
// `preview`), so nothing else is asked of it; one that is on must carry its modules.
// Anything else is a ContractError, not a half-built Catalog that fails when rendered.

const ENDPOINT = 'GET /trainer/catalog'

export const parseCatalog = (value: unknown, endpoint = ENDPOINT): Catalog => {
  const issues = new Issues()
  if (!isRecord(value))
    throw new ContractError(endpoint, [`body: expected an object, got ${kindOf(value)}`])
  issues.boolean('enabled', value.enabled)
  issues.optional('reason', value.reason, (path, v) => issues.string(path, v))
  issues.optional('preview', value.preview, (path, v) => issues.boolean(path, v))
  issues.optional('level', value.level, (path, v) => issues.string(path, v))
  issues.optional('content_version', value.content_version, (path, v) => issues.string(path, v))
  issues.optional('vocab_due', value.vocab_due, (path, v) => issues.number(path, v))

  if (value.enabled === true) {
    issues.array('modules', value.modules, (path, module) => {
      if (!issues.record(path, module)) return
      issues.string(`${path}.key`, module.key)
      issues.string(`${path}.title`, module.title)
      issues.optional(`${path}.lessons`, module.lessons, (lessonsPath, lessons) =>
        issues.array(lessonsPath, lessons, (lessonPath, lesson) => {
          if (issues.record(lessonPath, lesson)) issues.string(`${lessonPath}.id`, lesson.id)
        })
      )
    })
    // The flat form the screens read: absent is allowed, a wrong type is not.
    for (const name of ['lessons', 'activities', 'skills'] as const)
      issues.optional(name, value[name], (path, v) => issues.array(path, v))
  }
  const language = value.language
  if (language !== undefined && language !== null && typeof language !== 'string')
    issues.record('language', language)
  issues.settle(endpoint)

  // The backend names the language by its code; older mocks send { code, name }.
  return (typeof language === 'string'
    ? { ...value, language: { code: language, name: '' } }
    : value) as unknown as Catalog
}

// Whether an enabled catalog has any lesson to practice, in either form. Only called
// after `enabled` is known to be true.
export const hasContent = (catalog: Catalog): boolean =>
  (catalog.lessons?.length ?? 0) > 0 ||
  (catalog.modules ?? []).some((module) => (module.lessons?.length ?? 0) > 0)
