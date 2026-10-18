import { useMemo } from 'react'
import { useQueries, type QueryClient, type UseQueryResult } from '@tanstack/react-query'
import { fetchDraftConsistently } from '../course-map/data/draftCache.ts'
import { courseMapKeys, retryTransient } from '../course-map/data/queryKeys.ts'
import { useCourseMapsByCourse } from '../course-map/data/queries.ts'
import type { Activity, CourseMapDetail, ResolvedCourseMap } from '../course-map/data/types.ts'
import type { MoodleState, MoodleStateParams } from '../course-map/moodle/moodleState.ts'
import { useEmbed } from './EmbedContext.ts'
import {
  NOT_PLACED,
  applyHostStatus,
  indexCourseState,
  resolveHostBubbles,
  toActivity,
  type Placement,
} from './hostDerivation.ts'
import { useHostState } from './hostState.ts'

// A module-level combine keeps the result stable until some level's data
// actually changes.
const combinePlacements = (
  results: UseQueryResult<CourseMapDetail>[]
): Record<number, Placement> => {
  const placements: Record<number, Placement> = {}
  for (const { data } of results) {
    for (const bubble of data?.bubbles ?? []) {
      placements[bubble.activityId] = {
        placed: true,
        bubbleId: bubble.id,
        placedInMapId: data!.id,
      }
    }
  }
  return placements
}

// Embed mode: the Moodle plugin computes, for the current user, which
// activities exist, which are restricted or hidden and which are complete, and
// sends it as a CourseState. This turns that into the same shapes the backend
// source produces, so nothing downstream knows the difference. Bubble placement
// (which activity sits on which level) still comes from the backend's drafts.
export const useHostMoodleState = ({
  draftId,
  publishedId,
  showPublished,
  isEditor,
  moodleCourseId,
  bubbles,
}: MoodleStateParams): MoodleState => {
  const embed = useEmbed()
  const hostState = useHostState()
  const index = useMemo(() => (hostState ? indexCourseState(hostState) : null), [hostState])
  const mapId = draftId ?? publishedId ?? ''

  // Where each activity is placed, across the course's levels: the editor's
  // "ya colocada" state. Students never see unplaced activities, so they skip it.
  const levelsQuery = useCourseMapsByCourse(showPublished ? null : moodleCourseId)
  const placementByCmid = useQueries({
    queries: (levelsQuery.data ?? []).map((level) => ({
      queryKey: courseMapKeys.detail(level.id),
      queryFn: ({ client }: { client: QueryClient }) => fetchDraftConsistently(client, level.id),
      staleTime: 30_000,
      retry: retryTransient,
    })),
    combine: combinePlacements,
  })

  const statusBubbles = useMemo(
    () => (index ? applyHostStatus(index, bubbles) : bubbles),
    [index, bubbles]
  )

  const resolved = useMemo<ResolvedCourseMap | undefined>(
    () =>
      index
        ? {
            moodleStatus: 'live',
            bubbles: resolveHostBubbles(index, statusBubbles, mapId, isEditor),
          }
        : undefined,
    [index, statusBubbles, mapId, isEditor]
  )

  const activities = useMemo<Activity[]>(() => {
    if (!index || !hostState) return []
    // Like the backend, students get each activity through the map's own
    // bubbles; only the draft view lists everything in the course.
    if (showPublished)
      return (resolved?.bubbles ?? []).flatMap((rb) => (rb.activity ? [rb.activity] : []))
    return hostState.activities
      .filter((host) => isEditor || host.availability !== 'hidden')
      .map((host) => toActivity(index, host, placementByCmid[host.cmid] ?? NOT_PLACED))
  }, [index, hostState, showPublished, isEditor, resolved, placementByCmid])

  const refresh = () => embed?.requestState()

  return {
    bubbles: statusBubbles,
    activities,
    activitiesPending: index === null,
    activitiesError: false,
    refetchActivities: refresh,
    resolved,
    resolvedPending: index === null,
    resolvedError: false,
    refetchResolved: refresh,
  }
}
