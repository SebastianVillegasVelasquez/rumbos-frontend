import {
  Suspense,
  lazy,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  List,
  Loader2,
  Maximize2,
  TriangleAlert,
  RefreshCw,
} from 'lucide-react'
import { ActivitySidebar } from './features/course-map/components/ActivitySidebar.tsx'
import { ActivityModal } from './features/course-map/components/ActivityModal.tsx'
import { ActivitiesOverviewModal } from './features/course-map/components/ActivitiesOverviewModal.tsx'
import { MapsHome } from './features/course-map/components/MapsHome.tsx'
import { CourseLevels } from './features/course-map/components/CourseLevels.tsx'
import { StudentStage, type ContinueAction } from './features/hud/StudentStage.tsx'
import { StudentLevelsChrome } from './features/hud/StudentLevelsChrome.tsx'
import { WriteSyncHost } from './features/course-map/components/WriteSyncHost.tsx'
import { PublicationBar } from './features/course-map/components/publication/PublicationBar.tsx'
import { LazyBackgroundPicker } from './features/course-map/components/background/LazyBackgroundPicker.tsx'
import { useChangeBackground } from './features/course-map/components/background/useChangeBackground.ts'
import { rememberCourseMap } from './features/course-map/data/recentMaps.ts'
import {
  initialMapView,
  rememberMapView,
  type MapViewKind,
} from './features/view3d/mapViewPreference.ts'
import {
  ACTIVITY_OPEN_MODE,
  createActivityOpener,
  isSafeActivityUrl,
} from './features/course-map/activityOpener.ts'
import {
  useCourseMap,
  useCourseMapsByCourse,
  useCreateBubble,
  usePendingActivityIds,
  usePublicationState,
  usePublishedCourseMap,
  usePublishedMapsByCourse,
  useSkins,
} from './features/course-map/data/queries.ts'
import { useDeleteBubble, useUpdateBubble } from './features/course-map/data/draftMutations.ts'
import { isWriteDiscarded } from './features/course-map/data/writeQueue.ts'
import {
  ApiError,
  isPreconditionRequired,
  isUnreachable,
} from './features/course-map/data/client.ts'
import { resolveImageUrl } from './features/course-map/data/assets.ts'
import { courseTitleFrom } from './features/course-map/courseTitle.ts'
import { progressCounts } from './features/course-map/progress.ts'
import { useResume } from './features/hud/useResume.ts'
import { readResume } from './features/hud/resume.ts'
import { LazyAudioControl } from './features/audio/LazyAudioControl.tsx'
import type { AudioTrack } from './features/audio/audioSession.ts'
import { QuestLog } from './features/quests/QuestLog.tsx'
import { buildQuestEntries } from './features/quests/questEntries.ts'
import { readQuestsOpen, rememberQuestsOpen } from './features/quests/questsPreference.ts'
import { viewerStorage } from './features/quests/viewerStorage.ts'
import { continueTarget } from './features/course-map/continueTarget.ts'
import { useCompletionNotices } from './features/course-map/useCompletionNotices.ts'
import { draftToRenderable, publishedToRenderable } from './features/course-map/renderable.ts'
import type { MapCanvasControls } from './features/course-map/types/course-props.types.ts'
import type {
  Activity,
  MapInitialView,
  RenderableBubble,
  RenderableBubble as Bubble,
  ResolvedBubble,
} from './features/course-map/data/types.ts'
import { useBackendMoodleState } from './features/course-map/moodle/backendMoodleState.ts'
import { MoodleStateContext } from './features/course-map/moodle/moodleState.ts'
import { useEmbed } from './features/embed/EmbedContext.ts'
import {
  canConfigureCompletion,
  completionNotices,
} from './features/course-map/completionNotices.ts'
import {
  useHostCompletionEnabled,
  useHostSupportsActivitySettings,
} from './features/embed/hostState.ts'
import { RESERVED_CORNER_PX, useHostFullscreen } from './features/embed/hostFullscreen.ts'
import { useRoute, type Route } from './hooks/useRoute.ts'
import { Wordmark } from './components/Logo.tsx'
import { Button, IconButton } from './components/ui/Button.tsx'
import { Popover } from './components/ui/Popover.tsx'
import { SegmentedControl } from './components/ui/SegmentedControl.tsx'
import { ToastProvider } from './components/ui/Toast.tsx'
import { useToast } from './components/ui/toastContext.ts'
import { es } from './i18n/es.ts'
import { isDataSaverActive } from './fx/dataSaverStore.ts'
import { FpsMeter } from './fx/FpsMeter.tsx'
import { isFpsDebugEnabled } from './fx/debug.ts'

// Edición: the draft, editable. Vista previa (sin guardar): the draft shown as a
// student would see it. Guardado: the saved (published) version, exactly what
// students get.
type ViewMode = 'edit' | 'preview' | 'published'

// A link with ?view=published opens the student experience directly. There is
// no authentication yet, so this stands in for the student entry point.
// ?view=3d is the same entry, opened on the 3D view.
const initialViewMode = (): ViewMode => {
  const view = new URLSearchParams(window.location.search).get('view')
  return view === 'published' || view === '3d' ? 'published' : 'edit'
}

// Konva (and its React bindings) is only needed once a map is actually open,
// so it's kept out of the "Mis mapas" home bundle.
const MapCanvas = lazy(() =>
  import('./features/course-map/components/MapCanvas.tsx').then((m) => ({ default: m.MapCanvas }))
)
// The 3D view (an iframe plus its bridge) is only mounted while 3D is active.
const Map3DPanel = lazy(() =>
  import('./features/view3d/Map3DPanel.tsx').then((m) => ({ default: m.Map3DPanel }))
)
// Also Konva-heavy (skin previews render through the same BubbleVisual/Stage
// machinery as the canvas), so it's lazy for the same reason.
const AppearanceStudio = lazy(() =>
  import('./features/course-map/components/AppearanceStudio.tsx').then((m) => ({
    default: m.AppearanceStudio,
  }))
)

document.title = `${es.app.wordmark} — ${es.home.title}`

const isWideViewport = () => window.matchMedia('(min-width: 640px)').matches

// A stable empty list, so a map that is still loading does not look new on
// every render.
const NO_BUBBLES: RenderableBubble[] = []

function App() {
  return (
    <ToastProvider>
      <AppShell />
      <WriteSyncHost />
      {isFpsDebugEnabled() && <FpsMeter />}
    </ToastProvider>
  )
}

export function AppShell() {
  const toast = useToast()
  // Under /embed the course is fixed by the token, the route lives in memory
  // (a guest must not push history entries onto the host page) and the
  // person's role decides the view: students only ever see the published map.
  const embed = useEmbed()
  const fixedHome = useMemo<Route | undefined>(
    () =>
      embed ? { name: 'course', moodleCourseId: embed.courseId, forceEntry: false } : undefined,
    [embed]
  )
  const [route, navigate] = useRoute(fixedHome)
  // The Moodle data source: the backend here, the embed host under /embed.
  const useMoodleState = use(MoodleStateContext) ?? useBackendMoodleState
  // Embedded, the host decides whether this is the editor's UI (embed.mode): in
  // student mode the app shows the saved map and no editor UI, even to an editor.
  const hostStudentMode = embed?.mode === 'student'
  const [chosenViewMode, setViewMode] = useState<ViewMode>(() =>
    embed ? (embed.mode === 'editor' ? 'edit' : 'published') : initialViewMode()
  )
  const viewMode: ViewMode = hostStudentMode ? 'published' : chosenViewMode
  // The iframe's height is the host's call (80dvh on phones, the whole screen
  // in fullscreen): size to the viewport it actually has.
  const shellHeight = embed ? 'h-dvh' : 'h-screen'
  const isFullscreen = useHostFullscreen()
  // The host owns leaving fullscreen (its exit control sits in the top-right
  // corner, above the app) and tells us when it ends; the app only asks to
  // enter, and never assumes it got there before the host says so.
  const fullscreenControl =
    embed && !isFullscreen ? (
      <Button variant="surface" size="sm" onClick={() => embed.requestFullscreen(true)}>
        <Maximize2 size={16} strokeWidth={2.5} aria-hidden />
        {es.embed.fullscreen}
      </Button>
    ) : null
  // An editor looking at the student view needs a way back to editing now that
  // the header is gone. Never offered to students.
  const exitPreview =
    !hostStudentMode && viewMode !== 'edit'
      ? {
          label: viewMode === 'preview' ? es.hud.previewExit : es.hud.publishedExit,
          onExit: () => setViewMode('edit'),
        }
      : null
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)
  const [isActivitiesMenuOpen, setIsActivitiesMenuOpen] = useState(false)
  const [isActivitiesOverviewOpen, setIsActivitiesOverviewOpen] = useState(false)
  // Misiones. The side panel's state is remembered; a bottom sheet always
  // starts closed (see questsPreference).
  const [questsOpen, setQuestsOpen] = useState(
    () => isWideViewport() && readQuestsOpen(viewerStorage())
  )
  const [activeQuestBubbleId, setActiveQuestBubbleId] = useState<string | null>(null)
  const setQuests = (open: boolean) => {
    setQuestsOpen(open)
    if (isWideViewport()) rememberQuestsOpen(open, viewerStorage())
  }
  const toggleQuests = () => setQuests(!questsOpen)
  const closeQuests = () => setQuests(false)
  const [focusBubbleId, setFocusBubbleId] = useState<string | null>(null)
  // Data saver does not start the 3D world by itself: a remembered 3D choice is
  // set aside (an explicit ?view=3d link or the toggle still work).
  const [mapView, setMapView] = useState<MapViewKind>(() =>
    isDataSaverActive() && !new URLSearchParams(window.location.search).has('view')
      ? '2d'
      : initialMapView()
  )
  const [cachedNoticeDismissed, setCachedNoticeDismissed] = useState(false)
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false)
  const [isBackgroundPickerOpen, setIsBackgroundPickerOpen] = useState(false)
  // Written on every MapCanvas viewport tick (see onViewportChange below),
  // read once when the appearance studio's "usar vista actual" is clicked -
  // a ref, not state, so panning/zooming never re-renders AppShell.
  const latestViewportRef = useRef<MapInitialView | null>(null)

  const isEditor = viewMode === 'edit'
  // Students and the editor's previews get the immersive stage, no header.
  const immersive = !isEditor
  const mapControlsRef = useRef<MapCanvasControls>(null)
  // The camera tagged with its level, for resuming (see useResume).
  const resumeViewRef = useRef<{ mapId: string; view: MapInitialView } | null>(null)
  // The level the student had open last time, honored once at the start.
  const [resumeLevelId, setResumeLevelId] = useState<string | null>(() =>
    embed && embed.mode === 'student' && route.name === 'course'
      ? readResume(viewerStorage(), route.moodleCourseId).lastMapId
      : null
  )
  const handleResumeHandled = useCallback(() => setResumeLevelId(null), [])
  // Continuar's first tap shows the activity; the second opens it.
  const [armedBubbleId, setArmedBubbleId] = useState<string | null>(null)
  const showPublished = viewMode === 'published'

  const changeMapView = (next: MapViewKind) => {
    setMapView(next)
    rememberMapView(next)
  }

  const courseMapId = route.name === 'map' ? route.mapId : null
  // Draft and published data use separate queries; only the one for the
  // current view mode is enabled.
  const draftId = showPublished ? null : courseMapId
  const publishedId = showPublished ? courseMapId : null

  const draftQuery = useCourseMap(draftId)
  const publishedQuery = usePublishedCourseMap(publishedId)
  const mapQuery = showPublished ? publishedQuery : draftQuery
  const publicationState = usePublicationState(draftId)
  const createBubble = useCreateBubble(courseMapId ?? '')
  const updateBubble = useUpdateBubble(courseMapId ?? '')
  const deleteBubble = useDeleteBubble(courseMapId ?? '')
  const pendingActivityIds = usePendingActivityIds(courseMapId ?? '')
  // Embedded students may only read published data, whose skins are frozen
  // into the snapshot.
  const skinsQuery = useSkins(!hostStudentMode)
  const changeBackground = useChangeBackground(courseMapId ?? '')

  // The one shape the canvas, HUD and skin resolution consume, whichever
  // side it came from.
  const storedRenderable = useMemo(() => {
    if (showPublished)
      return publishedQuery.data ? publishedToRenderable(publishedQuery.data) : null
    return draftQuery.data ? draftToRenderable(draftQuery.data, skinsQuery.data?.items ?? []) : null
  }, [showPublished, publishedQuery.data, draftQuery.data, skinsQuery.data])
  const moodleCourseId = storedRenderable?.moodleCourseId ?? null

  const moodle = useMoodleState({
    draftId,
    publishedId,
    showPublished,
    isEditor,
    moodleCourseId,
    bubbles: storedRenderable?.bubbles ?? NO_BUBBLES,
  })
  // The map with each bubble's status as the Moodle source reports it.
  const renderable = useMemo(
    () => (storedRenderable ? { ...storedRenderable, bubbles: moodle.bubbles } : null),
    [storedRenderable, moodle.bubbles]
  )

  // Siblings of the currently-open level, for the breadcrumb and prev/next
  // navigation - only meaningful once we know which course this map
  // belongs to, so it's fetched off the map query, not the route.
  const draftSiblingsQuery = useCourseMapsByCourse(showPublished ? null : moodleCourseId)
  const publishedSiblingsQuery = usePublishedMapsByCourse(showPublished ? moodleCourseId : null)
  const siblingsData = showPublished ? publishedSiblingsQuery.data : draftSiblingsQuery.data
  const siblingLevels = useMemo(() => siblingsData ?? [], [siblingsData])
  const currentLevelIndex = siblingLevels.findIndex((level) => level.id === courseMapId)
  const prevLevel = currentLevelIndex > 0 ? siblingLevels[currentLevelIndex - 1] : null
  const nextLevel =
    currentLevelIndex !== -1 && currentLevelIndex < siblingLevels.length - 1
      ? siblingLevels[currentLevelIndex + 1]
      : null

  useEffect(() => {
    if (draftQuery.data && !embed) rememberCourseMap(draftQuery.data)
  }, [draftQuery.data, embed])

  useEffect(() => {
    document.title = renderable
      ? `${renderable.title} — ${es.app.wordmark}`
      : `${es.app.wordmark} — ${es.home.title}`
  }, [renderable])

  const resolvedBubbles = moodle.resolved?.bubbles
  const activities = moodle.activities
  const bubbles = useMemo(() => renderable?.bubbles ?? NO_BUBBLES, [renderable])
  const unplacedCount = activities.filter((activity) => !activity.placed).length

  const resolvedByBubbleId = useMemo(
    () => new Map<string, ResolvedBubble>((resolvedBubbles ?? []).map((rb) => [rb.bubbleId, rb])),
    [resolvedBubbles]
  )
  const moodleStatus = moodle.resolved?.moodleStatus ?? null

  const isSaving = updateBubble.isPending || createBubble.isPending || deleteBubble.isPending

  // A write the user was already told about (conflict dialog / toast) is not
  // an error to repeat in the banner.
  const realError = (error: unknown) => (isWriteDiscarded(error) ? null : error)
  const saveFailure = realError(updateBubble.error)
    ? { message: es.app.saveReverted, error: updateBubble.error }
    : createBubble.isError
      ? { message: es.app.placeActivityError, error: createBubble.error }
      : realError(deleteBubble.error)
        ? { message: es.app.deleteBubbleError, error: deleteBubble.error }
        : null
  const saveErrorMessage = saveFailure
    ? isPreconditionRequired(saveFailure.error)
      ? es.conflict.clientBug
      : isUnreachable(saveFailure.error)
        ? `${saveFailure.message} ${es.app.unreachableServer}`
        : saveFailure.message
    : null

  const dismissSaveError = () => {
    updateBubble.reset()
    createBubble.reset()
    deleteBubble.reset()
  }

  // Embedded, the host opens the activity: only its cmid is sent, never a URL.
  const openActivity = useMemo(
    () =>
      embed
        ? (activity: Activity) => embed.openActivity(activity.activityId)
        : createActivityOpener(ACTIVITY_OPEN_MODE, setSelectedActivity),
    [embed]
  )

  const handleBubbleClick = (bubble: Bubble) => {
    const resolved = resolvedByBubbleId.get(bubble.id)
    const activity =
      resolved?.activity ?? activities.find((a) => a.activityId === bubble.activityId)
    if (activity) openActivity(activity)
  }

  // Student presentation only (MapCanvas forces this to null in edit mode):
  // joins GET .../resolved against the map's own bubbles to decide whether a
  // bubble can be opened, replacing the old "is it in the live activities
  // list" heuristic with the precise available/hidden/missing/unknown states
  // from the backend.
  const getUnavailableReason = (bubble: Bubble): string | null => {
    if (moodle.resolvedPending) return es.bubble.loadingActivity
    if (moodle.resolvedError) return es.bubble.activitiesUnavailable
    const resolved = resolvedByBubbleId.get(bubble.id)
    if (!resolved) return null
    if (resolved.availability === 'hidden') return es.bubble.hiddenTooltipStudent
    if (resolved.availability === 'missing') return es.bubble.unavailable
    if (resolved.availability === 'unknown') return null
    if (resolved.availability === 'restricted')
      return resolved.activity?.availabilityInfo?.trim() || es.bubble.restricted
    // Embedded, the host opens activities by cmid; there is no URL to check.
    if (!embed && resolved.activity && !isSafeActivityUrl(resolved.activity.url))
      return es.bubble.cannotOpen
    return null
  }

  const getAvailabilityForBubble = (bubble: Bubble) =>
    resolvedByBubbleId.get(bubble.id)?.availability
  useCompletionNotices({
    levelKey: courseMapId,
    ready: !moodle.resolvedPending && !moodle.resolvedError,
    bubbles,
    // A teaser has no activity behind it, so its name is never spoken.
    nameOf: (bubble) => resolvedByBubbleId.get(bubble.id)?.activity?.name ?? null,
    enabled: !isEditor,
  })
  const progress = progressCounts(
    bubbles,
    getAvailabilityForBubble,
    isEditor ? 'editor' : 'student'
  )
  const mapMode = renderable?.settings.mode ?? 'explorative'
  // Editor: activities Moodle does not track (the host's v5.4 flags say whether
  // completion is on for the course and whether it can open the settings page).
  const completionEnabled = useHostCompletionEnabled()
  const supportsActivitySettings = useHostSupportsActivitySettings()
  const untrackedCount = isEditor
    ? bubbles.filter(
        (bubble) => bubble.tracked === false && getAvailabilityForBubble(bubble) !== 'missing'
      ).length
    : 0
  const notices = completionNotices({
    isEditor,
    embedded: Boolean(embed),
    completionEnabled,
    mode: mapMode,
    untrackedCount,
  })
  const configureCompletion =
    embed &&
    canConfigureCompletion({
      embedded: true,
      editorMode: embed.mode === 'editor',
      hostSpeaksV54: supportsActivitySettings,
    })
      ? (cmid: number) => embed.openActivitySettings(cmid)
      : undefined
  const questGroups = buildQuestEntries({
    bubbles: immersive ? bubbles : NO_BUBBLES,
    mode: mapMode,
    availabilityOf: getAvailabilityForBubble,
    activityOf: (bubble) => resolvedByBubbleId.get(bubble.id)?.activity,
  })
  const nextTarget = immersive
    ? continueTarget(bubbles, mapMode, getAvailabilityForBubble, 'student')
    : null
  const nextTargetName = nextTarget
    ? activities.find((a) => a.activityId === nextTarget.activityId)?.name
    : undefined
  const continueArmed = nextTarget !== null && armedBubbleId === nextTarget.id
  const continueAction: ContinueAction =
    progress.allComplete && nextLevel
      ? { kind: 'next-level', onClick: () => navigate({ name: 'map', mapId: nextLevel.id }) }
      : progress.allComplete
        ? { kind: 'done' }
        : nextTarget && nextTargetName
          ? continueArmed
            ? {
                kind: 'continue',
                label: es.hud.open(nextTargetName),
                onClick: () => {
                  setArmedBubbleId(null)
                  handleBubbleClick(nextTarget)
                },
              }
            : {
                kind: 'continue',
                label: es.hud.continue(nextTargetName),
                onClick: () => {
                  setActiveQuestBubbleId(nextTarget.id)
                  setFocusBubbleId(nextTarget.id)
                  setArmedBubbleId(nextTarget.id)
                },
              }
          : { kind: 'none' }
  // The level's background music, if any. Memoized by what defines the track so
  // the same track stays one track across re-renders and levels.
  const audio = renderable?.audio ?? null
  const audioTrack = useMemo<AudioTrack | null>(
    () =>
      audio
        ? {
            assetId: audio.settings.assetId,
            url: resolveImageUrl(`/assets/${audio.settings.assetId}`),
            loop: audio.settings.loop,
            volume: audio.settings.volume,
            startAfterInteraction: audio.settings.startAfterInteraction,
            title: audio.info.title,
            credit: audio.info.credit,
          }
        : null,
    // The track is defined by these values, not by the object that carries them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      audio?.settings.assetId,
      audio?.settings.loop,
      audio?.settings.volume,
      audio?.settings.startAfterInteraction,
      audio?.info.title,
      audio?.info.credit,
    ]
  )
  const resumeCourseId = renderable?.moodleCourseId ?? null
  const resumeMapId = renderable?.id ?? null
  useResume({
    enabled: immersive && resumeMapId !== null,
    courseId: resumeCourseId,
    mapId: resumeMapId,
    viewRef: resumeViewRef,
  })
  // The camera the student had on this level, read once when it opens.
  const savedView = useMemo(
    () =>
      immersive && resumeCourseId !== null && resumeMapId !== null
        ? (readResume(viewerStorage(), resumeCourseId).views[resumeMapId] ?? null)
        : null,
    [immersive, resumeCourseId, resumeMapId]
  )
  const getModname = (bubble: { activityId: number }) =>
    activities.find((a) => a.activityId === bubble.activityId)?.modname

  const handleSelectBubbleFromOverview = (bubble: Bubble) => {
    setIsActivitiesOverviewOpen(false)
    setFocusBubbleId(bubble.id)
  }

  // 3D is for students and the editor's preview; editing stays on the 2D map.
  const view3d = renderable?.view3d ?? null
  const show3d = !isEditor && view3d !== null && mapView === '3d'

  const renderMapArea = (layout?: { guardCompact: boolean }) => {
    if (mapQuery.isPending) {
      return (
        <p className="flex items-center gap-2 text-sm text-ink-soft">
          <Loader2 size={16} className="animate-spin" />
          {es.app.loadingCourseMap}
        </p>
      )
    }

    if (mapQuery.isError || !renderable) {
      const status = mapQuery.error instanceof ApiError ? mapQuery.error.status : null
      if (showPublished && status === 404) {
        // A link to a level that was never saved (404 not_published). An editor
        // seen in student mode is told how to set it up.
        const editorNeedsEditing = embed?.role === 'editor'
        return (
          <div className="space-y-3" role="status">
            <p className="font-heading text-lg font-semibold text-ink">
              {editorNeedsEditing ? es.embed.noSavedMap : es.student.levelUnavailable}
            </p>
            {!editorNeedsEditing && (
              <p className="text-sm text-ink-soft">{es.student.levelUnavailableHint}</p>
            )}
            <Button variant="secondary" onClick={() => navigate({ name: 'home' })}>
              {es.app.backToHome}
            </Button>
          </div>
        )
      }
      if (status === 404) {
        return (
          <div className="space-y-3">
            <p className="text-sm text-ink-soft">{es.app.courseMapNotFound}</p>
            <Button variant="secondary" onClick={() => navigate({ name: 'home' })}>
              {es.app.createNewMap}
            </Button>
          </div>
        )
      }
      return (
        <div className="space-y-3">
          <p className="text-sm text-coral-dark">{es.app.courseMapLoadError}</p>
          <Button variant="secondary" onClick={() => void mapQuery.refetch()}>
            {es.app.retry}
          </Button>
        </div>
      )
    }

    return (
      <Suspense
        fallback={
          <p className="flex items-center gap-2 text-sm text-ink-soft">
            <Loader2 size={16} className="animate-spin" />
            {es.app.loadingCourseMap}
          </p>
        }
      >
        <MapCanvas
          backgroundUrl={resolveImageUrl(renderable.imageUrl)}
          ariaLabel={
            progress.nothingTracked
              ? es.canvas.ariaLabelNoTracking(renderable.title)
              : es.canvas.ariaLabelWithProgress(
                  renderable.title,
                  progress.completed,
                  progress.total
                )
          }
          bubbles={bubbles}
          editable={isEditor}
          touchGuard={Boolean(embed)}
          controlsRef={mapControlsRef}
          onConfigureCompletion={
            configureCompletion ? (bubble) => configureCompletion(bubble.activityId) : undefined
          }
          hideControls={immersive}
          compactGuard={layout?.guardCompact}
          fit={renderable.settings.fit}
          mapMode={renderable.settings.mode}
          key={renderable.id}
          initialView={savedView ?? renderable.settings.initialView}
          homeView={renderable.settings.initialView}
          intro={savedView ? 'none' : renderable.settings.intro}
          pathSettings={renderable.settings.path}
          ambient={renderable.settings.ambient}
          onViewportChange={(view) => {
            latestViewportRef.current = view
            resumeViewRef.current = { mapId: renderable.id, view }
          }}
          skins={renderable.skins}
          defaultSkinId={renderable.defaultSkinId}
          skinRules={renderable.skinRules}
          onBubbleMove={(bubbleId, x, y) => updateBubble.mutate({ bubbleId, input: { x, y } })}
          onBubbleUpdate={(bubbleId, input) => updateBubble.mutate({ bubbleId, input })}
          onBubbleDelete={(bubbleId) => deleteBubble.mutate(bubbleId)}
          onActivityDrop={(activityId, x, y) => {
            if (pendingActivityIds.includes(activityId)) return
            createBubble.mutate(
              { activityId, x, y },
              {
                onError: (error) => {
                  if (error instanceof ApiError && error.status === 409) {
                    const title = error.detail.courseMapTitle
                    toast.show(
                      typeof title === 'string'
                        ? es.sidebar.placedInAnotherLevel(title)
                        : es.sidebar.alreadyPlaced,
                      'error'
                    )
                  }
                },
              }
            )
          }}
          onBubbleClick={handleBubbleClick}
          getUnavailableReason={getUnavailableReason}
          getAvailability={getAvailabilityForBubble}
          getModnameForBubble={getModname}
          getResolvedActivity={(bubble) => resolvedByBubbleId.get(bubble.id)?.activity ?? null}
          focusBubbleId={focusBubbleId}
          onFocusHandled={() => setFocusBubbleId(null)}
        />
      </Suspense>
    )
  }

  const render3d = (view3dConfig: NonNullable<typeof view3d>) =>
    renderable && (
      <Suspense
        fallback={
          <p className="flex items-center gap-2 text-sm text-ink-soft">
            <Loader2 size={16} className="animate-spin" />
            {es.view3d.loading}
          </p>
        }
      >
        <Map3DPanel
          map={renderable}
          view3d={view3dConfig}
          resolved={moodle.resolved}
          isLoading={moodle.resolvedPending}
          view="student"
          onOpenBubble={handleBubbleClick}
          getUnavailableReason={getUnavailableReason}
          focusBubbleId={focusBubbleId}
          onFocusHandled={() => setFocusBubbleId(null)}
          onBackTo2d={() => changeMapView('2d')}
        />
      </Suspense>
    )

  const levelTitleById = useMemo(
    () => new Map(siblingLevels.map((level) => [level.id, level.title])),
    [siblingLevels]
  )

  const sidebarProps = {
    activities,
    pendingActivityIds,
    isLoading: moodle.activitiesPending,
    error: moodle.activitiesError,
    onRetry: moodle.refetchActivities,
    currentCourseMapId: courseMapId ?? undefined,
    levelTitleById,
    sectionFilter: renderable?.moodleSectionId ?? null,
  }

  // Embedded in student mode there is no mode switch: only the saved map is shown.
  const headerViewMode = hostStudentMode ? undefined : viewMode
  // Embedded, "home" is the course's level picker; with a single level there is
  // nowhere to go back to.
  const goHome = embed && siblingLevels.length <= 1 ? undefined : () => navigate({ name: 'home' })

  // "Guardado" needs a saved version; the level's own state says so.
  const neverPublished = publicationState.data?.status === 'never_published'

  if (route.name === 'home') {
    return (
      <div className={`flex ${shellHeight} flex-col`}>
        <AppHeader onHome={() => navigate({ name: 'home' })} />
        <MapsHome
          onOpen={(id) => navigate({ name: 'map', mapId: id })}
          onOpenCourse={(moodleCourseId) =>
            navigate({ name: 'course', moodleCourseId, forceEntry: true })
          }
        />
      </div>
    )
  }

  if (route.name === 'course') {
    return (
      <div className={`relative flex ${shellHeight} flex-col`}>
        {immersive ? (
          <StudentLevelsChrome
            exitPreview={exitPreview}
            onEnterFullscreen={embed && !isFullscreen ? () => embed.requestFullscreen(true) : null}
          />
        ) : (
          <AppHeader
            onHome={() => navigate({ name: 'home' })}
            viewMode={headerViewMode}
            onViewModeChange={setViewMode}
            fullscreenControl={fullscreenControl}
            reserveCorner={isFullscreen}
          />
        )}
        <CourseLevels
          moodleCourseId={route.moodleCourseId}
          viewMode={viewMode}
          onOpenLevel={(id) => navigate({ name: 'map', mapId: id })}
          resumeLevelId={resumeLevelId}
          onResumeHandled={handleResumeHandled}
        />
      </div>
    )
  }

  const breadcrumb =
    siblingLevels.length > 1 && currentLevelIndex !== -1 && renderable
      ? es.levels.breadcrumb(
          courseTitleFrom(siblingLevels),
          currentLevelIndex + 1,
          renderable.title
        )
      : renderable?.title

  return (
    <div className={`flex ${shellHeight} flex-col`}>
      {!immersive && (
        <AppHeader
          onHome={goHome}
          mapTitle={breadcrumb}
          prevLevelTitle={prevLevel?.title}
          nextLevelTitle={nextLevel?.title}
          onPrevLevel={prevLevel ? () => navigate({ name: 'map', mapId: prevLevel.id }) : undefined}
          onNextLevel={nextLevel ? () => navigate({ name: 'map', mapId: nextLevel.id }) : undefined}
          viewMode={headerViewMode}
          onViewModeChange={setViewMode}
          fullscreenControl={fullscreenControl}
          publishedDisabled={neverPublished}
          isSaving={isEditor ? isSaving : undefined}
          onActivitiesOverview={() => setIsActivitiesOverviewOpen(true)}
          onAppearance={isEditor ? () => setIsAppearanceOpen(true) : undefined}
          publicationBar={
            isEditor && courseMapId ? <PublicationBar courseMapId={courseMapId} /> : null
          }
          activitiesMenu={
            isEditor ? (
              <Popover
                open={isActivitiesMenuOpen}
                onOpenChange={setIsActivitiesMenuOpen}
                align="end"
                trigger={
                  <Button variant="surface" size="sm">
                    <List size={16} strokeWidth={2.5} aria-hidden />
                    {es.app.activities}
                    {unplacedCount > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-primary px-1 text-xs font-bold text-white">
                        {unplacedCount}
                      </span>
                    )}
                    <ChevronDown
                      size={16}
                      strokeWidth={3}
                      aria-hidden
                      className={`motion-safe:transition-transform ${isActivitiesMenuOpen ? 'rotate-180' : ''}`}
                    />
                  </Button>
                }
              >
                <ActivitySidebar
                  {...sidebarProps}
                  className="flex max-h-[70dvh] w-[min(20rem,calc(100vw-4rem))] flex-col"
                />
              </Popover>
            ) : null
          }
        />
      )}
      <div className="flex flex-1 overflow-hidden">
        <main
          className={`flex min-h-0 flex-1 flex-col overflow-hidden ${immersive ? '' : 'p-1 sm:p-1.5'}`}
        >
          {notices.courseDisabled && (
            <div
              role="status"
              className="border-soft mb-2 flex items-start gap-2 rounded-md bg-sun-tint px-3 py-2 text-sm font-semibold text-sun-dark"
            >
              <TriangleAlert size={18} strokeWidth={2.5} aria-hidden className="mt-0.5 shrink-0" />
              <span>{es.completion.disabledBanner}</span>
            </div>
          )}
          {notices.guidedWithUntracked && (
            <div
              role="alert"
              className="border-strong mb-2 flex items-start gap-2 rounded-md bg-danger-tint px-3 py-2 text-sm font-bold text-danger"
            >
              <TriangleAlert size={20} strokeWidth={2.5} aria-hidden className="mt-0.5 shrink-0" />
              <span>
                {es.completion.guidedWarning}{' '}
                <span className="font-semibold">
                  {es.completion.guidedWarningCount(untrackedCount)}
                </span>
              </span>
            </div>
          )}
          {isEditor && (
            <p className="px-1 pb-1 text-xs font-semibold text-ink-soft">
              {es.publication.autosaveHint}
            </p>
          )}
          {moodleStatus === 'unavailable' && (
            <div
              role="alert"
              className="border-soft mb-3 flex items-center justify-between gap-3 rounded-md bg-sun-tint px-4 py-2 text-sm font-semibold text-sun-dark"
            >
              <span>{es.moodleBanner.unavailable}</span>
              <button
                type="button"
                onClick={moodle.refetchResolved}
                className="flex min-h-[44px] shrink-0 items-center gap-1 font-bold underline-offset-2 hover:underline"
              >
                <RefreshCw size={16} strokeWidth={2.5} />
                {es.moodleBanner.retry}
              </button>
            </div>
          )}
          {moodleStatus === 'cached' && !cachedNoticeDismissed && (
            <div className="border-soft mb-3 flex items-center justify-between gap-3 rounded-md bg-surface-muted px-4 py-2 text-xs font-semibold text-ink-soft">
              <span>{es.moodleBanner.cached}</span>
              <button
                type="button"
                onClick={() => setCachedNoticeDismissed(true)}
                className="min-h-[44px] font-bold underline-offset-2 hover:underline"
              >
                {es.app.dismiss}
              </button>
            </div>
          )}
          {saveErrorMessage && (
            <div
              role="alert"
              className="border-soft mb-3 flex items-center justify-between rounded-md bg-danger-tint px-4 py-2 text-sm font-semibold text-danger"
            >
              <span>{saveErrorMessage}</span>
              <button
                type="button"
                onClick={dismissSaveError}
                className="ml-4 min-h-[44px] font-bold underline-offset-2 hover:underline"
              >
                {es.app.dismiss}
              </button>
            </div>
          )}
          <div className="relative min-h-0 flex-1">
            {immersive && renderable ? (
              <StudentStage
                levelTitle={renderable.title}
                levelPosition={
                  siblingLevels.length > 1 && currentLevelIndex !== -1
                    ? { index: currentLevelIndex + 1, count: siblingLevels.length }
                    : null
                }
                progress={progress}
                onOpenLevels={
                  siblingLevels.length > 1 ? () => navigate({ name: 'home' }) : undefined
                }
                coachMarks={!exitPreview}
                questsOpen={questsOpen}
                onToggleQuests={toggleQuests}
                questsPanel={({ compact, bottomOffset }) => (
                  <QuestLog
                    open={questsOpen}
                    compact={compact}
                    bottomOffset={bottomOffset}
                    groups={questGroups}
                    progress={progress}
                    activeBubbleId={activeQuestBubbleId}
                    onFocusBubble={(bubbleId) => {
                      setActiveQuestBubbleId(bubbleId)
                      setFocusBubbleId(bubbleId)
                    }}
                    onOpenBubble={(bubbleId) => {
                      const bubble = bubbles.find((item) => item.id === bubbleId)
                      if (bubble) handleBubbleClick(bubble)
                    }}
                    onClose={closeQuests}
                    onResetView={
                      show3d ? undefined : () => mapControlsRef.current?.resetToInitial()
                    }
                  />
                )}
                view={view3d ? { value: show3d ? '3d' : '2d', onChange: changeMapView } : null}
                zoom={
                  show3d
                    ? null
                    : {
                        zoomIn: () => mapControlsRef.current?.zoomIn(),
                        zoomOut: () => mapControlsRef.current?.zoomOut(),
                        recenter: () => mapControlsRef.current?.recenter(),
                      }
                }
                audio={audioTrack ? <LazyAudioControl track={audioTrack} /> : null}
                onEnterFullscreen={
                  embed && !isFullscreen ? () => embed.requestFullscreen(true) : null
                }
                continueAction={continueAction}
                exitPreview={exitPreview}
                embedded={Boolean(embed)}
              >
                {(layout) => (show3d && view3d ? render3d(view3d) : renderMapArea(layout))}
              </StudentStage>
            ) : show3d && renderable && view3d ? (
              render3d(view3d)
            ) : (
              renderMapArea()
            )}
          </div>
        </main>
      </div>

      <ActivityModal activity={selectedActivity} onClose={() => setSelectedActivity(null)} />

      <ActivitiesOverviewModal
        open={isEditor && isActivitiesOverviewOpen}
        bubbles={bubbles}
        activities={activities}
        mode={renderable?.settings.mode ?? 'explorative'}
        view="editor"
        getAvailability={getAvailabilityForBubble}
        onClose={() => setIsActivitiesOverviewOpen(false)}
        onSelectBubble={handleSelectBubbleFromOverview}
        onConfigureCompletion={configureCompletion}
      />

      {isEditor && isAppearanceOpen && draftQuery.data && (
        <Suspense fallback={null}>
          <AppearanceStudio
            courseMap={draftQuery.data}
            skins={skinsQuery.data?.items ?? []}
            activities={activities}
            getCurrentView={() => latestViewportRef.current}
            onClose={() => setIsAppearanceOpen(false)}
            onChangeBackground={() => setIsBackgroundPickerOpen(true)}
            onPreview3d={() => {
              // The draft as a student would see it, in 3D.
              setIsAppearanceOpen(false)
              setViewMode('preview')
              changeMapView('3d')
            }}
          />
        </Suspense>
      )}

      {isEditor && renderable && (
        <LazyBackgroundPicker
          open={isBackgroundPickerOpen}
          onOpenChange={setIsBackgroundPickerOpen}
          currentImageUrl={renderable.imageUrl}
          map={renderable}
          getModnameForBubble={getModname}
          onApply={changeBackground}
        />
      )}
    </div>
  )
}

const AppHeader = ({
  onHome,
  mapTitle,
  prevLevelTitle,
  nextLevelTitle,
  onPrevLevel,
  onNextLevel,
  viewMode,
  onViewModeChange,
  publishedDisabled,
  isSaving,
  onActivitiesOverview,
  onAppearance,
  publicationBar,
  activitiesMenu,
  fullscreenControl,
  reserveCorner,
}: {
  onHome?: () => void
  mapTitle?: string
  prevLevelTitle?: string
  nextLevelTitle?: string
  onPrevLevel?: () => void
  onNextLevel?: () => void
  viewMode?: ViewMode
  onViewModeChange?: (mode: ViewMode) => void
  publishedDisabled?: boolean
  isSaving?: boolean
  onActivitiesOverview?: () => void
  onAppearance?: () => void
  publicationBar?: ReactNode
  activitiesMenu?: ReactNode
  fullscreenControl?: ReactNode
  // Fullscreen: the host's exit control sits in the top-right corner, above
  // the app, so nothing of ours may be placed there.
  reserveCorner?: boolean
}) => {
  return (
    <header
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b-strong bg-accent px-2 py-1 sm:px-3"
      style={
        reserveCorner
          ? { paddingRight: RESERVED_CORNER_PX, minHeight: RESERVED_CORNER_PX }
          : undefined
      }
    >
      <div className="flex min-w-0 items-center gap-2">
        {onHome ? (
          <button
            type="button"
            onClick={onHome}
            aria-label={es.app.wordmark}
            className="inline-flex min-h-[44px] shrink-0 items-center rounded-md"
          >
            <Wordmark collapsible={Boolean(mapTitle)} />
          </button>
        ) : (
          <span className="inline-flex min-h-[44px] shrink-0 items-center">
            <Wordmark collapsible={Boolean(mapTitle)} />
          </span>
        )}
        {mapTitle && (
          <>
            <span className="shrink-0 text-ink">/</span>
            <span className="min-w-0 truncate text-sm font-bold text-ink" title={mapTitle}>
              {mapTitle}
            </span>
          </>
        )}
        {(onPrevLevel || onNextLevel) && (
          <div className="flex shrink-0 items-center">
            <IconButton
              aria-label={
                prevLevelTitle ? `${es.levels.prevLevel}: ${prevLevelTitle}` : es.levels.prevLevel
              }
              variant="ghost"
              disabled={!onPrevLevel}
              onClick={onPrevLevel}
            >
              <ChevronLeft size={16} />
            </IconButton>
            <IconButton
              aria-label={
                nextLevelTitle ? `${es.levels.nextLevel}: ${nextLevelTitle}` : es.levels.nextLevel
              }
              variant="ghost"
              disabled={!onNextLevel}
              onClick={onNextLevel}
            >
              <ChevronRight size={16} />
            </IconButton>
          </div>
        )}
      </div>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
        {isSaving !== undefined && (
          <span className="text-xs font-bold text-ink">
            {isSaving ? es.app.saving : es.app.saved}
          </span>
        )}
        {publicationBar}
        {activitiesMenu}
        {onAppearance && (
          <Button variant="surface" size="sm" onClick={onAppearance}>
            {es.studio.open}
          </Button>
        )}
        {onActivitiesOverview && (
          <Button variant="surface" size="sm" onClick={onActivitiesOverview}>
            {es.app.activitiesOverview}
          </Button>
        )}
        {fullscreenControl}
        {viewMode && onViewModeChange && (
          // TEMPORARY: a view toggle stands in for real editor/student
          // roles until authentication exists.
          <SegmentedControl
            aria-label={es.viewMode.label}
            value={viewMode}
            onChange={onViewModeChange}
            options={[
              { value: 'edit', label: es.viewMode.edit },
              { value: 'preview', label: es.viewMode.preview },
              {
                value: 'published',
                label: es.viewMode.published,
                disabled: publishedDisabled,
                hint: es.viewMode.publishedDisabled,
              },
            ]}
          />
        )}
      </div>
    </header>
  )
}

export default App
