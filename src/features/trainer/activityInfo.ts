import type { ActivityInfo, Catalog } from './types.ts'

// What the practice intro shows about an activity. The backend has no route for one
// activity: the catalog already carries all of it (id, title, skill, role, can_do,
// step_count), plus the lesson it sits in. Null when the catalog does not list it.
export const activityInfoOf = (
  catalog: Catalog | undefined,
  activityId: string
): ActivityInfo | null => {
  for (const module of catalog?.modules ?? [])
    for (const lesson of module.lessons) {
      const activity = lesson.activities.find((candidate) => candidate.id === activityId)
      if (activity)
        return {
          id: activity.id,
          title: activity.title,
          skill: activity.skill,
          lesson_id: lesson.id,
          role: activity.role,
          can_do: activity.can_do,
          step_count: activity.step_count,
        }
    }
  return null
}

// The activity after `activityId` in the catalog's own order (the rest of its lesson, then
// the lessons after it). The sessions' answers do not name one.
export const nextActivityId = (catalog: Catalog | undefined, activityId: string): string | null => {
  const ids = (catalog?.modules ?? []).flatMap((module) =>
    module.lessons.flatMap((lesson) => lesson.activities.map((activity) => activity.id))
  )
  const at = ids.indexOf(activityId)
  return at === -1 ? null : (ids[at + 1] ?? null)
}
