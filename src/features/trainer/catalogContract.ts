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
    issues.optional('title', value.title, (path, v) => issues.string(path, v))
    // Every field below is required by the OpenAPI (Catalog* schemas) and read by a screen.
    issues.array('modules', value.modules, (path, module) => {
      if (!issues.record(path, module)) return
      issues.string(`${path}.key`, module.key)
      issues.string(`${path}.title`, module.title)
      issues.array(`${path}.lessons`, module.lessons, (lessonPath, lesson) => {
        if (!issues.record(lessonPath, lesson)) return
        for (const name of ['id', 'code', 'title', 'description'] as const)
          issues.string(`${lessonPath}.${name}`, lesson[name])
        issues.number(`${lessonPath}.vocabulary_count`, lesson.vocabulary_count)
        issues.array(`${lessonPath}.activities`, lesson.activities, (actPath, act) => {
          if (!issues.record(actPath, act)) return
          for (const name of ['id', 'skill', 'title'] as const)
            issues.string(`${actPath}.${name}`, act[name])
          issues.number(`${actPath}.estimated_minutes`, act.estimated_minutes)
          issues.number(`${actPath}.step_count`, act.step_count)
          issues.optional(`${actPath}.role`, act.role, (p, v) => issues.string(p, v))
          issues.array(`${actPath}.can_do`, act.can_do, (p, v) => issues.string(p, v))
          issues.oneOf(`${actPath}.publication_state`, act.publication_state, PUBLICATION_STATES)
          issues.oneOf(`${actPath}.state`, act.state, ACTIVITY_STATES)
          issues.optional(`${actPath}.best_percent`, act.best_percent, (p, v) =>
            issues.number(p, v)
          )
        })
      })
    })
    for (const name of ['skills'] as const)
      issues.optional(name, value[name], (path, v) => issues.array(path, v))
  }
  const language = value.language
  if (language !== undefined && language !== null && typeof language !== 'string')
    issues.record('language', language)
  issues.settle(endpoint)

  // The backend names the language by its code; older mocks send { code, name }.
  // The backend names the language by its code; the screens read { code, name }.
  const catalog = (typeof language === 'string'
    ? { ...value, language: { code: language, name: '' } }
    : value) as unknown as Catalog
  return catalog.enabled
    ? { ...catalog, preview: catalog.preview ?? hasUnpublished(catalog) }
    : catalog
}

const PUBLICATION_STATES = ['draft', 'reviewed', 'published']
const ACTIVITY_STATES = ['not_started', 'in_progress', 'finished']

// The backend sends non-published items to editors in preview only, and its Catalog
// schema has no `preview` flag: an item that is not published is the signal.
const hasUnpublished = (catalog: Catalog): boolean =>
  (catalog.modules ?? []).some((m) =>
    m.lessons.some((l) => l.activities.some((a) => a.publication_state !== 'published'))
  )

// Whether an enabled catalog has any lesson to practice. Only called after `enabled`
// is known to be true. The server's list, as it came: nothing is filtered here.
export const hasContent = (catalog: Catalog): boolean =>
  (catalog.modules ?? []).some((module) => module.lessons.length > 0)
