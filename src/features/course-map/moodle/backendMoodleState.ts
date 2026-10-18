import { useMemo } from 'react'
import {
  useActivities,
  usePublishedResolvedCourseMap,
  useResolvedCourseMap,
} from '../data/queries.ts'
import type { MoodleState, MoodleStateParams } from './moodleState.ts'

// Standalone mode: Moodle data comes from the backend. The editor reads the
// live activity list and resolves the draft with hidden activities included;
// students get each activity through the published /resolved answer, since the
// published API has no activities endpoint.
export const useBackendMoodleState = ({
  draftId,
  publishedId,
  showPublished,
  isEditor,
  bubbles,
}: MoodleStateParams): MoodleState => {
  // Always unfiltered: besides the sidebar, this also backs icon/modname
  // lookups for every bubble on the map, which can come from any section.
  // onlySection is applied client-side, just for the sidebar's own list -
  // see ActivitySidebar's sectionFilter prop.
  const activitiesQuery = useActivities(draftId, isEditor, false)
  const draftResolved = useResolvedCourseMap(draftId, isEditor)
  const publishedResolved = usePublishedResolvedCourseMap(publishedId, false)
  const resolvedQuery = showPublished ? publishedResolved : draftResolved

  const resolvedBubbles = resolvedQuery.data?.bubbles
  const activities = useMemo(() => {
    if (showPublished)
      return (resolvedBubbles ?? []).flatMap((rb) => (rb.activity ? [rb.activity] : []))
    return activitiesQuery.data ?? []
  }, [showPublished, resolvedBubbles, activitiesQuery.data])

  return {
    bubbles,
    activities,
    activitiesPending: activitiesQuery.isPending,
    activitiesError: activitiesQuery.isError,
    refetchActivities: () => void activitiesQuery.refetch(),
    resolved: resolvedQuery.data,
    resolvedPending: resolvedQuery.isPending,
    resolvedError: resolvedQuery.isError,
    refetchResolved: () => void resolvedQuery.refetch(),
  }
}
