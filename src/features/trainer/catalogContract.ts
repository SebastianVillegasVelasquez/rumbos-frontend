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
  // Required by both answers (Catalog and CatalogUnavailable): it says whether the caller
  // is an editor in preview, so the banner shows even when there is no content.
  issues.boolean('preview', value.preview)
  issues.optional('level', value.level, (path, v) => issues.string(path, v))
  issues.optional('content_version', value.content_version, (path, v) => issues.string(path, v))

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
          // An enum value the front does not know: an error for an editor in preview (where
          // contract drift must show) and in CI (the contract test), tolerated for a student,
          // who should still practise. See DECISIONS-trainer.md (D18).
          for (const [name, allowed] of [
            ['publication_state', PUBLICATION_STATES],
            ['state', ACTIVITY_STATES],
          ] as const)
            if (value.preview === true) issues.oneOf(`${actPath}.${name}`, act[name], allowed)
            else issues.string(`${actPath}.${name}`, act[name])
          issues.optional(`${actPath}.best_percent`, act.best_percent, (p, v) =>
            issues.number(p, v)
          )
        })
      })
    })
  }
  const language = value.language
  if (language !== undefined && language !== null && typeof language !== 'string')
    issues.record('language', language)
  issues.settle(endpoint)

  // The backend names the language by its code; the screens read { code, name }.
  return (typeof language === 'string'
    ? { ...value, language: { code: language, name: '' } }
    : value) as unknown as Catalog
}

const PUBLICATION_STATES = ['draft', 'reviewed', 'published']
const ACTIVITY_STATES = ['not_started', 'in_progress', 'finished']

// Whether an enabled catalog has any lesson to practice. Only called after `enabled`
// is known to be true. The server's list, as it came: nothing is filtered here.
export const hasContent = (catalog: Catalog): boolean =>
  (catalog.modules ?? []).some((module) => module.lessons.length > 0)
