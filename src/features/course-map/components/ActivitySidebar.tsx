import { useMemo, useState } from 'react'
import { ChevronDown, PartyPopper, Search } from 'lucide-react'
import type { Activity } from '../data/types.ts'
import { es } from '../../../i18n/es.ts'
import { Badge } from '../../../components/ui/Card.tsx'
import { Input } from '../../../components/ui/Input.tsx'

interface ActivitySidebarProps {
  activities: Activity[]
  pendingActivityIds: number[]
  isLoading: boolean
  error: boolean
  onRetry: () => void
  className?: string
  // Needed to tell "placed on this level" (filtered out, as before) apart
  // from "placed on another level of the same course" (shown, disabled).
  currentCourseMapId?: string
  levelTitleById?: Map<string, string>
  // When the level is linked to a Moodle section, only that section's
  // activities are offered here (applied client-side so the same
  // unfiltered `activities` list can also drive modname/icon lookups for
  // every bubble on the map, regardless of section).
  sectionFilter?: number | null
}

type ActivityType = keyof typeof es.activityTypes

const typeLabel = (modname: string) =>
  es.activityTypes[modname as ActivityType] ?? es.activityTypes.default

// Type-colored left border, using the design-system status/accent tones.
const TYPE_ACCENTS: Record<string, string> = {
  quiz: 'border-l-primary',
  scorm: 'border-l-leaf-dark',
  customcert: 'border-l-sun-dark',
  assign: 'border-l-danger',
  resource: 'border-l-slate-dark',
  url: 'border-l-ink',
}
const DEFAULT_ACCENT = 'border-l-slate-dark'

const handleDragStart = (e: React.DragEvent<HTMLLIElement>, activity: Activity) => {
  e.dataTransfer.setData('application/json', JSON.stringify({ activityId: activity.activityId }))
  e.dataTransfer.effectAllowed = 'copy'
}

const DEFAULT_CLASS_NAME = 'flex w-64 shrink-0 flex-col border-r-soft bg-surface p-4'

export const ActivitySidebar = ({
  activities,
  pendingActivityIds,
  isLoading,
  error,
  onRetry,
  className,
  currentCourseMapId,
  levelTitleById,
  sectionFilter = null,
}: ActivitySidebarProps) => {
  const [search, setSearch] = useState('')
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())

  // Truly draggable count for the "N por ubicar" badge.
  const trulyUnplacedCount = useMemo(
    () =>
      activities.filter(
        (activity) =>
          !activity.placed && (sectionFilter === null || activity.sectionId === sectionFilter)
      ).length,
    [activities, sectionFilter]
  )
  // Rendered list: available to drag, or placed on a different level of
  // this course (shown disabled with where it is) - only "placed on this
  // level" is hidden, since that's already on the canvas as a bubble.
  const unplaced = useMemo(
    () =>
      activities.filter(
        (activity) =>
          (!activity.placed || activity.placedInMapId !== currentCourseMapId) &&
          (sectionFilter === null || activity.sectionId === sectionFilter)
      ),
    [activities, currentCourseMapId, sectionFilter]
  )
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? unplaced.filter((activity) => activity.name.toLowerCase().includes(q)) : unplaced
  }, [unplaced, search])

  const sections = useMemo(() => {
    const bySection = new Map<string, Activity[]>()
    for (const activity of filtered) {
      const list = bySection.get(activity.sectionName) ?? []
      list.push(activity)
      bySection.set(activity.sectionName, list)
    }
    return Array.from(bySection.entries())
  }, [filtered])

  const toggleSection = (name: string) => {
    setCollapsedSections((current) => {
      const next = new Set(current)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const renderList = () => {
    if (error) {
      return (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-danger">{es.sidebar.loadError}</p>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-[44px] items-center text-sm font-bold text-primary underline-offset-2 hover:underline"
          >
            {es.app.retry}
          </button>
        </div>
      )
    }
    if (isLoading) return <p className="text-sm text-ink-soft">{es.sidebar.loading}</p>
    if (filtered.length === 0) {
      return (
        <div className="flex flex-col items-center gap-2 rounded-md border-soft border-dashed bg-leaf-tint p-6 text-center">
          <PartyPopper size={22} strokeWidth={2.5} className="text-leaf-dark" aria-hidden />
          <p className="text-sm font-semibold text-leaf-dark">{es.sidebar.empty}</p>
        </div>
      )
    }

    return (
      <div className="space-y-3">
        {sections.map(([sectionName, items]) => {
          const isCollapsed = collapsedSections.has(sectionName)
          return (
            <div key={sectionName}>
              <button
                type="button"
                onClick={() => toggleSection(sectionName)}
                className="flex w-full min-h-[44px] items-center justify-between text-left text-xs font-bold uppercase tracking-wide text-ink-soft"
              >
                <span className="truncate">{sectionName}</span>
                <ChevronDown
                  size={16}
                  strokeWidth={3}
                  aria-hidden
                  className={`shrink-0 motion-safe:transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                />
              </button>
              {!isCollapsed && (
                <ul className="mt-1.5 space-y-2">
                  {items.map((activity) => {
                    const isPending = pendingActivityIds.includes(activity.activityId)
                    const placedElsewhere =
                      activity.placed && activity.placedInMapId !== currentCourseMapId
                    const disabled = isPending || placedElsewhere
                    return (
                      <li
                        key={activity.activityId}
                        draggable={!disabled}
                        aria-disabled={disabled}
                        onDragStart={(e) => !disabled && handleDragStart(e, activity)}
                        className={`flex min-h-[44px] flex-col justify-center gap-1 rounded-md border-hair border-l-[6px] bg-surface-muted px-3 py-2 text-sm transition-colors ${
                          TYPE_ACCENTS[activity.modname] ?? DEFAULT_ACCENT
                        } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-grab hover:bg-primary-tint active:cursor-grabbing'}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="line-clamp-2 min-w-0 flex-1 break-words font-semibold text-ink">
                            {activity.name}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-soft">
                          <span className="font-bold">{typeLabel(activity.modname)}</span>
                          {activity.hidden && <Badge tone="sun">{es.sidebar.hiddenBadge}</Badge>}
                          {placedElsewhere && (
                            <Badge tone="slate">
                              {es.sidebar.placedInAnotherLevel(
                                (activity.placedInMapId &&
                                  levelTitleById?.get(activity.placedInMapId)) ??
                                  ''
                              )}
                            </Badge>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <aside className={className ?? DEFAULT_CLASS_NAME}>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-ink-soft">
          {es.sidebar.title}
        </h2>
        <span className="text-xs font-bold text-primary">
          {es.sidebar.remainingCount(trulyUnplacedCount)}
        </span>
      </div>
      <p className="mb-3 text-xs text-ink-soft">{es.sidebar.hint}</p>
      <div className="relative mb-3">
        <Search
          size={16}
          strokeWidth={2.5}
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-dark"
        />
        <Input
          density="compact"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={es.sidebar.searchPlaceholder}
          className="pl-9 text-xs"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{renderList()}</div>
    </aside>
  )
}
