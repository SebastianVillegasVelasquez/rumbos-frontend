import { ContractError, Issues, isRecord, kindOf } from '../course-map/data/contract.ts'
import type { Catalog, CatalogActivity, CatalogLesson } from './types.ts'

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
          if (!issues.record(lessonPath, lesson)) return
          issues.string(`${lessonPath}.id`, lesson.id)
          issues.string(`${lessonPath}.title`, lesson.title)
          issues.optional(`${lessonPath}.publication_state`, lesson.publication_state, (p, v) =>
            issues.string(p, v)
          )
          // What the lesson list needs of each activity. Nothing else is asked: a
          // field the backend does not send is not invented, and not required.
          issues.optional(`${lessonPath}.activities`, lesson.activities, (actsPath, acts) =>
            issues.array(actsPath, acts, (actPath, act) => {
              if (!issues.record(actPath, act)) return
              issues.string(`${actPath}.id`, act.id)
              issues.string(`${actPath}.title`, act.title)
              issues.string(`${actPath}.skill`, act.skill)
              issues.optional(`${actPath}.publication_state`, act.publication_state, (p, v) =>
                issues.string(p, v)
              )
              issues.optional(`${actPath}.state`, act.state, (p, v) => issues.string(p, v))
              issues.optional(`${actPath}.best_percent`, act.best_percent, (p, v) =>
                issues.number(p, v)
              )
            })
          )
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
  const catalog = (typeof language === 'string'
    ? { ...value, language: { code: language, name: '' } }
    : value) as unknown as Catalog
  return catalog.enabled ? flatten(catalog) : catalog
}

const asRecords = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? (value as Record<string, unknown>[]) : []

// The screens read flat `lessons` and `activities`; the backend nests them under their
// module. This only reshapes: nothing is dropped, whatever the publication_state, because
// who may see a draft is the server's decision (it sends students published items only).
// The flat form the mock sends is left as it is.
const flatten = (catalog: Catalog): Catalog => {
  const nested = (catalog.modules ?? []).some((m) => Array.isArray(m.lessons) && m.lessons.length)
  if (!nested) return catalog
  const lessons: CatalogLesson[] = [...(catalog.lessons ?? [])]
  const activities: CatalogActivity[] = [...(catalog.activities ?? [])]
  for (const module of catalog.modules ?? []) {
    for (const lesson of asRecords(module.lessons)) {
      lessons.push({
        id: lesson.id as string,
        module: module.key,
        code: (lesson.code as string | undefined) ?? '',
        title: lesson.title as string,
        description: (lesson.description as string | undefined) ?? '',
        locked: lesson.locked === true,
        publication_state: lesson.publication_state as string | undefined,
      })
      for (const act of asRecords(lesson.activities)) {
        const best = typeof act.best_percent === 'number' ? act.best_percent : null
        activities.push({
          id: act.id as string,
          lesson_id: lesson.id as string,
          skill: act.skill as CatalogActivity['skill'],
          title: act.title as string,
          estimated_minutes: (act.estimated_minutes as number | undefined) ?? null,
          step_count: (act.step_count as number | undefined) ?? null,
          locked: act.locked === true,
          completed_count:
            (act.completed_count as number | undefined) ?? (act.state === 'completed' ? 1 : 0),
          best_score: (act.best_score as number | null | undefined) ?? best,
          state: act.state as string | undefined,
          publication_state: act.publication_state as string | undefined,
        })
      }
    }
  }
  return { ...catalog, lessons, activities }
}

// Whether an enabled catalog has any lesson to practice, in either form. Only called
// after `enabled` is known to be true.
export const hasContent = (catalog: Catalog): boolean =>
  (catalog.lessons?.length ?? 0) > 0 ||
  (catalog.modules ?? []).some((module) => (module.lessons?.length ?? 0) > 0)
