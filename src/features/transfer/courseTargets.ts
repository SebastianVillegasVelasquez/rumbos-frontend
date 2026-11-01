import type { CourseState } from '../embed/protocol.ts'
import type { Activity } from '../course-map/data/types.ts'
import type { Target } from './matching.ts'

// The course's activities as the matching and the export describe them: name,
// type, section and the place inside the section.

interface Entry {
  cmid: number
  name: string
  modname: string
  // Two entries share a section when this is equal.
  sectionKey: number
  sectionNumber: number
  sectionName: string
}

// Position counts from 1, in the order the source lists the activities. The
// export and the import both use this function, so what one writes the other
// reads back the same way.
const toTargets = (entries: Entry[]): Target[] => {
  const counters = new Map<number, number>()
  return entries.map((entry) => {
    const position = (counters.get(entry.sectionKey) ?? 0) + 1
    counters.set(entry.sectionKey, position)
    return {
      cmid: entry.cmid,
      name: entry.name,
      modname: entry.modname,
      sectionNumber: entry.sectionNumber,
      sectionName: entry.sectionName,
      positionInSection: position,
    }
  })
}

// Embedded: the host's state, which lists activities in course order.
export const targetsFromCourseState = (state: CourseState): Target[] => {
  const sections = new Map(state.sections.map((section) => [section.id, section]))
  return toTargets(
    state.activities.map((activity) => ({
      cmid: activity.cmid,
      name: activity.name,
      modname: activity.modname,
      sectionKey: activity.sectionId,
      sectionNumber: sections.get(activity.sectionId)?.number ?? 0,
      sectionName: sections.get(activity.sectionId)?.name ?? '',
    }))
  )
}

// Standalone: the backend's activity list.
export const targetsFromActivities = (activities: Activity[]): Target[] =>
  toTargets(
    activities.map((activity) => ({
      cmid: activity.activityId,
      name: activity.name,
      modname: activity.modname,
      sectionKey: activity.sectionId,
      sectionNumber: activity.sectionNumber,
      sectionName: activity.sectionName,
    }))
  )

export const descriptorsFor = (cmids: Iterable<number>, targets: Target[]): Target[] => {
  const wanted = new Set(cmids)
  return targets.filter((target) => wanted.has(target.cmid))
}
