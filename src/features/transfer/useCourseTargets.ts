import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { courseMapApi } from '../course-map/data/index.ts'
import { retryTransient } from '../course-map/data/queryKeys.ts'
import { useEmbed } from '../embed/EmbedContext.ts'
import { useHostState } from '../embed/hostState.ts'
import { targetsFromActivities, targetsFromCourseState } from './courseTargets.ts'
import type { Target } from './matching.ts'

// The course's activities, from wherever this mode gets them: the host's state
// when embedded, the backend's list (through any level of the course) when
// standalone. A standalone course with no level has no list to read.
export const useCourseTargets = (
  anyLevelId: string | null,
  enabled: boolean
): { targets: Target[]; pending: boolean } => {
  const embed = useEmbed()
  const hostState = useHostState()
  const standalone = useQuery({
    queryKey: ['transfer', 'activities', anyLevelId],
    queryFn: () => courseMapApi.getActivities(anyLevelId!, true, false),
    enabled: !embed && enabled && anyLevelId !== null,
    retry: retryTransient,
    staleTime: 30_000,
  })
  const targets = useMemo(() => {
    if (embed) return hostState ? targetsFromCourseState(hostState) : []
    return targetsFromActivities(standalone.data ?? [])
  }, [embed, hostState, standalone.data])
  return {
    targets,
    pending: embed ? !hostState : anyLevelId !== null && enabled && standalone.isPending,
  }
}
