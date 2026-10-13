import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { MoreVertical, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Button, IconButton } from '../../../components/ui/Button.tsx'
import { Badge, Card } from '../../../components/ui/Card.tsx'
import { Dialog } from '../../../components/ui/Dialog.tsx'
import { Input } from '../../../components/ui/Input.tsx'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog.tsx'
import { DropdownMenu } from '../../../components/ui/DropdownMenu.tsx'
import { Skeleton, EmptyState } from '../../../components/ui/Skeleton.tsx'
import { useToast } from '../../../components/ui/toastContext.ts'
import { BackgroundField, type BackgroundChoice } from './background/BackgroundField.tsx'
import { DEFAULT_BACKGROUND_CHOICE } from './background/defaultBackground.ts'
import { es } from '../../../i18n/es.ts'
import { ApiError, isUnreachable } from '../data/client.ts'
import { resolveThumbUrl } from '../data/assets.ts'
import { courseMapApi } from '../data/index.ts'
import { useCourseMaps, useCreateCourseMap, useDeleteCourseMap } from '../data/queries.ts'
import { useUpdateCourseMap } from '../data/draftMutations.ts'
import { getRecentCourseMaps, type RecentCourseMap } from '../data/recentMaps.ts'
import { courseTitleFrom } from '../courseTitle.ts'
import type { CourseMapSummary } from '../data/types.ts'

interface MapsHomeProps {
  onOpen: (courseMapId: string) => void
  // A course with several levels opens the carousel instead of a map
  // directly.
  onOpenCourse: (moodleCourseId: number) => void
}

const relativeTime = new Intl.RelativeTimeFormat('es-CO', { numeric: 'auto' })

const formatRelative = (iso: string) => {
  const diffMs = new Date(iso).getTime() - Date.now()
  const diffMinutes = Math.round(diffMs / 60_000)
  if (Math.abs(diffMinutes) < 60) return relativeTime.format(diffMinutes, 'minute')
  const diffHours = Math.round(diffMinutes / 60)
  if (Math.abs(diffHours) < 24) return relativeTime.format(diffHours, 'hour')
  const diffDays = Math.round(diffHours / 24)
  return relativeTime.format(diffDays, 'day')
}

const useDebouncedValue = (value: string, delayMs: number) => {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

const MapCard = ({
  map,
  onOpen,
  onRename,
  onDelete,
}: {
  map: CourseMapSummary
  onOpen: (id: string) => void
  onRename: (map: CourseMapSummary) => void
  onDelete: (map: CourseMapSummary) => void
}) => (
  <Card variant="item" className="group relative overflow-hidden">
    <button type="button" onClick={() => onOpen(map.id)} className="block w-full text-left">
      <div className="border-b-soft h-32 w-full overflow-hidden bg-surface-muted">
        <img
          src={resolveThumbUrl(map.imageUrl)}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
      </div>
      <div className="space-y-1 p-4">
        <p className="truncate font-heading text-lg font-extrabold text-ink">{map.title}</p>
        <p className="text-xs font-semibold text-ink-soft">
          {es.home.card.course(map.moodleCourseId)}
        </p>
        <div className="flex items-center justify-between text-xs font-semibold text-slate-dark">
          <span>{es.home.card.activities(map.bubbleCount)}</span>
          <span>{formatRelative(map.updatedAt)}</span>
        </div>
      </div>
    </button>
    <div className="absolute right-2 top-2">
      <DropdownMenu
        trigger={
          <IconButton aria-label={map.title} variant="secondary">
            <MoreVertical size={18} strokeWidth={2.5} />
          </IconButton>
        }
        items={[
          { label: es.home.card.open, onSelect: () => onOpen(map.id) },
          {
            label: es.home.card.rename,
            icon: <Pencil size={16} strokeWidth={2.5} />,
            onSelect: () => onRename(map),
          },
          {
            label: es.home.card.delete,
            icon: <Trash2 size={16} strokeWidth={2.5} />,
            onSelect: () => onDelete(map),
            destructive: true,
          },
        ]}
      />
    </div>
  </Card>
)

// A course with several levels: one card leading into the level carousel,
// instead of one card per level cluttering the home grid.
const CourseCard = ({
  group,
  onOpen,
}: {
  group: { moodleCourseId: number; levels: CourseMapSummary[] }
  onOpen: () => void
}) => {
  const cover = group.levels[0]
  const totalActivities = group.levels.reduce((sum, level) => sum + level.bubbleCount, 0)
  return (
    <Card variant="item" className="group relative overflow-hidden">
      <button
        type="button"
        onClick={onOpen}
        aria-label={courseTitleFrom(group.levels)}
        className="block w-full text-left"
      >
        <div className="border-b-soft relative h-32 w-full overflow-hidden bg-surface-muted">
          <img
            src={resolveThumbUrl(cover.imageUrl)}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
          <Badge tone="sun" className="absolute right-2 top-2">
            {group.levels.length}
          </Badge>
        </div>
        <div className="space-y-1 p-4">
          <p className="truncate font-heading text-lg font-extrabold text-ink">
            {courseTitleFrom(group.levels)}
          </p>
          <p className="text-xs font-semibold text-ink-soft">
            {es.home.card.course(group.moodleCourseId)}
          </p>
          <p className="text-xs font-semibold text-slate-dark">
            {es.home.card.activities(totalActivities)}
          </p>
        </div>
      </button>
    </Card>
  )
}

export const MapsHome = ({ onOpen, onOpenCourse }: MapsHomeProps) => {
  const toast = useToast()
  const [searchInput, setSearchInput] = useState('')
  const q = useDebouncedValue(searchInput, 300)
  const [recent] = useState<RecentCourseMap | null>(() => getRecentCourseMaps()[0] ?? null)
  const [createOpen, setCreateOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<CourseMapSummary | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CourseMapSummary | null>(null)

  const mapsQuery = useCourseMaps({ q })
  const items = useMemo(
    () => (mapsQuery.data?.pages ?? []).flatMap((page) => page.items),
    [mapsQuery.data]
  )
  const pages = mapsQuery.data?.pages ?? []
  const total = pages[0]?.total ?? 0

  // Groups the flat (updatedAt-sorted) list by course for the grid; a
  // single-level course still renders as today's plain map card.
  const courseGroups = useMemo(() => {
    const byId = new Map<number, CourseMapSummary[]>()
    for (const item of items)
      byId.set(item.moodleCourseId, [...(byId.get(item.moodleCourseId) ?? []), item])
    return Array.from(byId.entries()).map(([moodleCourseId, levels]) => ({
      moodleCourseId,
      levels,
    }))
  }, [items])

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-5xl space-y-6 pb-2 sm:space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="break-words font-heading text-3xl text-ink sm:text-4xl lg:text-5xl">
              {es.home.title}
            </h1>
            <p className="mt-2 text-sm font-semibold text-ink-soft">{es.home.subtitle}</p>
          </div>
          <Button className="w-full sm:w-auto" onClick={() => setCreateOpen(true)}>
            <Plus size={18} strokeWidth={3} />
            {es.home.createMap}
          </Button>
        </div>

        {recent && (
          <Card
            variant="item"
            className="flex flex-wrap items-center gap-3 overflow-hidden p-4 sm:gap-4"
          >
            <img
              src={resolveThumbUrl(recent.imageUrl)}
              alt=""
              className="border-hair h-14 w-14 rounded-md object-cover"
            />
            <div className="min-w-0 flex-1 basis-40">
              <p className="text-xs font-bold uppercase tracking-wide text-primary">
                {es.home.continueWhereLeft}
              </p>
              <p className="truncate font-heading text-lg font-extrabold text-ink">
                {recent.title}
              </p>
            </div>
            <Button
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => onOpen(recent.id)}
            >
              {es.home.card.open}
            </Button>
          </Card>
        )}

        <div className="relative w-full sm:max-w-sm">
          <Search
            size={18}
            strokeWidth={3}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink"
          />
          <Input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={es.home.searchPlaceholder}
            aria-label={es.home.searchPlaceholder}
            className="pl-10"
          />
        </div>

        {mapsQuery.isPending && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44" />
            ))}
          </div>
        )}

        {mapsQuery.isError && (
          <EmptyState
            title={es.home.error.title}
            description={es.home.error.description}
            action={
              <Button variant="secondary" onClick={() => void mapsQuery.refetch()}>
                {es.app.retry}
              </Button>
            }
          />
        )}

        {mapsQuery.isSuccess && items.length === 0 && (
          <EmptyState
            title={q ? es.home.searchEmpty.title : es.home.empty.title}
            description={q ? es.home.searchEmpty.description : es.home.empty.description}
          />
        )}

        {items.length > 0 && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
              {q
                ? // Searching flattens: a result could be any
                  // level of any course, grouping would hide
                  // the very thing that matched.
                  items.map((map) => (
                    <MapCard
                      key={map.id}
                      map={map}
                      onOpen={onOpen}
                      onRename={setRenameTarget}
                      onDelete={setDeleteTarget}
                    />
                  ))
                : courseGroups.map((group) =>
                    group.levels.length > 1 ? (
                      <CourseCard
                        key={group.moodleCourseId}
                        group={group}
                        onOpen={() => onOpenCourse(group.moodleCourseId)}
                      />
                    ) : (
                      <MapCard
                        key={group.levels[0].id}
                        map={group.levels[0]}
                        onOpen={onOpen}
                        onRename={setRenameTarget}
                        onDelete={setDeleteTarget}
                      />
                    )
                  )}
            </div>
            {items.length < total && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="secondary"
                  disabled={mapsQuery.isFetchingNextPage}
                  onClick={() => void mapsQuery.fetchNextPage()}
                >
                  {es.home.loadMore}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <CreateMapDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={onOpen} />
      <RenameMapDialog
        key={renameTarget?.id ?? 'none'}
        map={renameTarget}
        onOpenChange={() => setRenameTarget(null)}
      />
      <DeleteMapDialog
        map={deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        onDeleted={() => toast.show(es.home.card.delete + ' ✓', 'success')}
      />
    </div>
  )
}

const describeCreateError = (error: unknown): 'conflict' | 'unreachable' | 'generic' => {
  if (isUnreachable(error)) return 'unreachable'
  if (error instanceof ApiError && error.status === 409) return 'conflict'
  return 'generic'
}

const CreateMapDialog = ({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (id: string) => void
}) => {
  const [title, setTitle] = useState('')
  const [courseId, setCourseId] = useState('')
  const [background, setBackground] = useState<BackgroundChoice | null>(DEFAULT_BACKGROUND_CHOICE)
  const [conflictMapId, setConflictMapId] = useState<string | null>(null)
  const createMap = useCreateCourseMap()

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setTitle('')
      setCourseId('')
      setBackground(DEFAULT_BACKGROUND_CHOICE)
      setConflictMapId(null)
      createMap.reset()
    }
    onOpenChange(next)
  }

  const errorKind = createMap.isError ? describeCreateError(createMap.error) : null

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmedTitle = title.trim()
    const moodleCourseId = Number(courseId)
    if (!trimmedTitle || !Number.isInteger(moodleCourseId) || moodleCourseId <= 0 || !background)
      return

    setConflictMapId(null)
    createMap.mutate(
      { title: trimmedTitle, moodleCourseId, imageUrl: background.imageUrl },
      {
        onSuccess: (map) => onCreated(map.id),
        onError: async (error) => {
          if (describeCreateError(error) === 'conflict') {
            const result = await courseMapApi.listCourseMaps({ moodleCourseId, limit: 1 })
            setConflictMapId(result.items[0]?.id ?? null)
          }
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} title={es.home.create.title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">
            {es.home.create.titleLabel}
          </span>
          <Input
            density="compact"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={es.home.create.titlePlaceholder}
            maxLength={120}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">
            {es.home.create.courseIdLabel}
          </span>
          <Input
            density="compact"
            type="number"
            min={1}
            step={1}
            required
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
          />
        </label>
        <div className="space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">
            {es.home.create.backgroundLabel}
          </span>
          <BackgroundField value={background} onChange={setBackground} />
        </div>

        {errorKind === 'conflict' && (
          <div className="border-soft space-y-2 rounded-md bg-sun-tint p-3 text-sm font-semibold text-sun-dark">
            <p>{es.home.create.conflict}</p>
            {conflictMapId && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => onCreated(conflictMapId)}
              >
                {es.home.create.openExisting}
              </Button>
            )}
          </div>
        )}
        {errorKind === 'unreachable' && (
          <p className="text-sm font-semibold text-danger">{es.home.create.unreachable}</p>
        )}
        {errorKind === 'generic' && (
          <p className="text-sm font-semibold text-danger">{es.home.create.genericError}</p>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-2 pt-1">
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={() => handleOpenChange(false)}
          >
            {es.home.create.cancel}
          </Button>
          <Button
            type="submit"
            className="w-full sm:w-auto"
            disabled={createMap.isPending || !background}
          >
            {createMap.isPending ? es.home.create.submitting : es.home.create.submit}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

const RenameMapDialog = ({
  map,
  onOpenChange,
}: {
  map: CourseMapSummary | null
  onOpenChange: () => void
}) => {
  const [title, setTitle] = useState(map?.title ?? '')
  const updateMap = useUpdateCourseMap()

  if (!map) return null

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    updateMap.mutate(
      { courseMapId: map.id, input: { title: trimmed } },
      { onSuccess: onOpenChange }
    )
  }

  return (
    <Dialog open onOpenChange={onOpenChange} title={es.home.rename.title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">
            {es.home.rename.label}
          </span>
          <Input
            density="compact"
            type="text"
            required
            autoFocus
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-2">
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={onOpenChange}
          >
            {es.home.rename.cancel}
          </Button>
          <Button type="submit" className="w-full sm:w-auto" disabled={updateMap.isPending}>
            {es.home.rename.submit}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

const DeleteMapDialog = ({
  map,
  onOpenChange,
  onDeleted,
}: {
  map: CourseMapSummary | null
  onOpenChange: () => void
  onDeleted: () => void
}) => {
  const deleteMap = useDeleteCourseMap()
  if (!map) return null

  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title={es.home.deleteConfirm.title}
      description={es.home.deleteConfirm.description(map.bubbleCount)}
      confirmLabel={es.home.deleteConfirm.confirm}
      cancelLabel={es.home.deleteConfirm.cancel}
      onConfirm={() => deleteMap.mutate(map.id, { onSuccess: onDeleted })}
    />
  )
}
