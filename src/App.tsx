import { useQueryClient } from '@tanstack/react-query'
import { subscribeHostStateReceived } from './features/embed/hostState.ts'
import {
  Suspense,
  lazy,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Maximize2,
  TriangleAlert,
  RefreshCw,
  Flame,
} from 'lucide-react'
import { ActivitySidebar } from './features/course-map/components/ActivitySidebar.tsx'
import { ActivityModal } from './features/course-map/components/ActivityModal.tsx'
import { ActivitiesOverviewBody } from './features/course-map/components/ActivitiesOverview.tsx'
import { EditorShell, type RailItem } from './features/editor-shell/EditorShell.tsx'
import { ScrollRegion } from './features/editor-shell/ScrollRegion.tsx'
import {
  readFullscreenOnOpen,
  readSection,
  rememberFullscreenOnOpen,
  rememberSection,
  resolveSection,
  SECTION_IDS,
  sectionsFor,
  spreadPlacement,
  type SectionId,
} from './features/editor-shell/sections.ts'
import { useKeepStageThroughTab } from './features/embed/useKeepStageThroughTab.ts'
import { MapsHome } from './features/course-map/components/MapsHome.tsx'
import { CourseLevels } from './features/course-map/components/CourseLevels.tsx'
import {
  StudentStage,
  TRAINER_BUTTON_ID,
  CLOSING_BUTTON_ID,
  type ContinueAction,
} from './features/hud/StudentStage.tsx'
import { LazyTrainerStage } from './features/trainer/LazyTrainerStage.tsx'
import {
  entryMode,
  entryReason,
  entryState,
  noteIsPersistent,
} from './features/trainer/availability.ts'
import { classifyFailure } from './features/trainer/failure.ts'
import { useCatalog } from './features/trainer/useCatalog.ts'
import { StudentLevelsChrome } from './features/hud/StudentLevelsChrome.tsx'
import { WriteSyncHost } from './features/course-map/components/WriteSyncHost.tsx'
import { PublicationBar } from './features/course-map/components/publication/PublicationBar.tsx'
import { TransferMenu } from './features/transfer/TransferMenu.tsx'
import { LazyHeatmapPanel } from './features/heatmap/LazyHeatmapPanel.tsx'
import type { StepInput } from './features/heatmap/insights.ts'
import { LazyBackgroundPicker } from './features/course-map/components/background/LazyBackgroundPicker.tsx'
import { useImageSize } from './features/course-map/components/background/useImageSize.ts'
import { preferredAspectRatio } from './features/embed/preferredSize.ts'
import { isContentBubble, type Content } from './features/content/contentTypes.ts'
import { LazyContentEditor } from './features/content/editor/LazyContentEditor.tsx'
import { contentErrorMessage } from './features/content/editor/contentMessages.ts'
import { contentBytes } from './features/content/validateContent.ts'
import { LazyContentViewer } from './features/content/LazyContentViewer.tsx'
import {
  learnFromBubbles,
  learnFromCreated,
  learnFromCreateFailure,
  useContentSupported,
} from './features/content/contentSupport.ts'
import { isContentSeen, markContentSeen, shouldAutoOpen } from './features/content/seen.ts'
import { useWidgetsEnabled } from './features/content/useAuthFeatures.ts'
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
import { resolveCoverUrl, resolveImageUrl } from './features/course-map/data/assets.ts'
import { progressCounts } from './features/course-map/progress.ts'
import { useResume } from './features/hud/useResume.ts'
import { readResume } from './features/hud/resume.ts'
import { useHostCourseName } from './features/embed/hostCourse.ts'
import { LazyWelcomeCurtain } from './features/welcome/LazyWelcomeCurtain.tsx'
import { LazyWelcomeFlow } from './features/welcome/flow/LazyWelcomeFlow.tsx'
import { closingStepsFor } from './features/assessment/closingJourney.ts'
import {
  closingFlowStateOf,
  closingPlaceOf,
  entriesToOpenWith,
  type ClosingFlowState,
} from './features/assessment/closingResume.ts'
import { useClosingProgress } from './features/assessment/useClosingProgress.ts'
import { ConfirmDialog } from './components/ui/ConfirmDialog.tsx'
import { JourneySimulator } from './features/assessment/JourneySimulator.tsx'
import {
  initialSim,
  simAllDone,
  simAttempt,
  simCheckin,
  simLastFailure,
  simRulesOf,
  simStatus,
  simWelcomeDone,
  simWelcomeSteps,
  type SimState,
} from './features/assessment/journeySimulation.ts'
import { esCongratulations } from './i18n/congratulations.es.ts'
import type { FlowSimulation } from './features/welcome/flow/flowSimulation.ts'
import { ClosingCard, JourneyOverlay, RouteCard } from './features/assessment/JourneyOverlay.tsx'
import { finalFailure } from './features/assessment/journeyTexts.ts'
import {
  markScreenSeen,
  wasScreenSeen,
  type JourneyScreen,
} from './features/assessment/journeyScreens.ts'
import { CLOSING_STATUS_KEY, useClosingStatus } from './features/assessment/useClosingStatus.ts'
import { useWelcome } from './features/welcome/useWelcome.ts'
import { welcomeTitle } from './features/welcome/welcome.ts'
import { cameraBridge } from './features/view3d/cameraBridge.ts'
import { LazyAudioControl } from './features/audio/LazyAudioControl.tsx'
import type { AudioTrack } from './features/audio/audioSession.ts'
import { QUESTS_BUTTON_ID, QuestLog } from './features/quests/QuestLog.tsx'
import { buildQuestEntries } from './features/quests/questEntries.ts'
import { readQuestsOpen, rememberQuestsOpen } from './features/quests/questsPreference.ts'
import { viewerStorage } from './features/quests/viewerStorage.ts'
import { continueTarget } from './features/course-map/continueTarget.ts'
import { useCompletionNotices } from './features/course-map/useCompletionNotices.ts'
import { draftToRenderable, publishedToRenderable } from './features/course-map/renderable.ts'
import type {
  BubbleHeat,
  MapCanvasControls,
} from './features/course-map/types/course-props.types.ts'
import type {
  Activity,
  MapInitialView,
  MapSettings,
  RenderableBubble,
  RenderableBubble as Bubble,
  ResolvedBubble,
  WelcomeStep,
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
import { useHostTutorAvailable } from './features/embed/hostCapabilities.ts'
import { useHostOverlayOpen } from './features/embed/hostOverlay.ts'
import {
  RESERVED_CORNER_PX,
  getHostFullscreen,
  useHostFullscreen,
} from './features/embed/hostFullscreen.ts'
import { useFullscreenEntry } from './features/embed/useFullscreenEntry.ts'
import { useKeepStageThroughVideo } from './features/embed/useKeepStageThroughVideo.ts'
import { useRoute, type Route } from './hooks/useRoute.ts'
import { Wordmark } from './components/Logo.tsx'
import { Button, IconButton } from './components/ui/Button.tsx'
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
const NO_STEPS: WelcomeStep[] = []
// What the simulation's rules are read from while there is no map.
const NO_SETTINGS = { schemaVersion: 1 } as MapSettings

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
  // A video leaving its own fullscreen must not take the host's stage with it.
  useKeepStageThroughVideo(embed)
  useKeepStageThroughTab(embed)
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
  // The editor's rail picks what the content area shows; the last choice is remembered.
  const [chosenSection, setChosenSection] = useState<SectionId>(() =>
    readSection(viewerStorage(), SECTION_IDS)
  )
  const [appearanceDirty, setAppearanceDirty] = useState(false)
  // Asking the host for the stage when the editor opens is the default; the ⋯ menu turns it off.
  const [fullscreenOnOpen, setFullscreenOnOpen] = useState(() =>
    readFullscreenOnOpen(viewerStorage())
  )
  const [isBackgroundPickerOpen, setIsBackgroundPickerOpen] = useState(false)
  // Written on every MapCanvas viewport tick (see onViewportChange below),
  // read once when the appearance studio's "usar vista actual" is clicked -
  // a ref, not state, so panning/zooming never re-renders AppShell.
  const latestViewportRef = useRef<MapInitialView | null>(null)

  const isEditor = viewMode === 'edit'
  // A long editing task is better on the whole stage: ask the host once when the editor
  // opens. Leaving it is the editor's call (the host's own control) and is never undone,
  // except for a PDF opened in another tab (see useKeepStageThroughTab).
  const requestStage = embed?.mode === 'editor' ? embed.requestFullscreen : null
  const askedStageRef = useRef(false)
  useEffect(() => {
    if (askedStageRef.current || !requestStage || !isEditor || !fullscreenOnOpen) return
    askedStageRef.current = true
    if (!getHostFullscreen()) requestStage(true)
  }, [requestStage, isEditor, fullscreenOnOpen])
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

  const setSection = (next: SectionId) => {
    setChosenSection(next)
    rememberSection(next, viewerStorage())
    // The heat map's own section is where it gets switched on.
    if (next === 'heat') setHeatWanted(true)
  }

  const changeMapView = (next: MapViewKind) => {
    setMapView(next)
    rememberMapView(next)
  }

  const courseMapId = route.name === 'map' ? route.mapId : null
  // The closing flow, and what the visit has dismissed on the way to it. Declared here with
  // the simulation, which clears them.
  const [closingOpen, setClosingOpen] = useState(false)
  const [journeyDismissed, setJourneyDismissed] = useState<(JourneyScreen | 'route')[]>([])
  const clearJourney = () => {
    setClosingOpen(false)
    setJourneyDismissed([])
  }
  // "Simular recorrido": in memory, for an editor looking at the student view of one level.
  // Leaving either ends it, with whatever it had open.
  const canSimulate = exitPreview !== null && embed?.role === 'editor'
  const [simRun, setSimRun] = useState<{ level: string; state: SimState } | null>(null)
  if (simRun && (!canSimulate || simRun.level !== courseMapId)) {
    setSimRun(null)
    clearJourney()
  }
  const sim = canSimulate && simRun?.level === courseMapId ? simRun.state : null
  const simulating = sim !== null
  const updateSim = (change: (state: SimState) => SimState) =>
    setSimRun((current) => current && { ...current, state: change(current.state) })
  // Draft and published data use separate queries; only the one for the
  // current view mode is enabled.
  const draftId = showPublished ? null : courseMapId
  const publishedId = showPublished ? courseMapId : null

  const draftQuery = useCourseMap(draftId)
  const publishedQuery = usePublishedCourseMap(publishedId)
  const mapQuery = showPublished ? publishedQuery : draftQuery
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
  // "Simular todas las actividades completadas" draws them so, over the map and in memory.
  const simCompleted = sim?.contentDone === true
  const bubbles = useMemo(() => {
    const own = renderable?.bubbles ?? NO_BUBBLES
    return simCompleted
      ? own.map((bubble) =>
          isContentBubble(bubble) ? bubble : { ...bubble, status: 'complete' as const }
        )
      : own
  }, [renderable, simCompleted])
  const unplacedCount = activities.filter((activity) => !activity.placed).length

  const resolvedByBubbleId = useMemo(
    () => new Map<string, ResolvedBubble>((resolvedBubbles ?? []).map((rb) => [rb.bubbleId, rb])),
    [resolvedBubbles]
  )
  const moodleStatus = moodle.resolved?.moodleStatus ?? null

  // Contract v5.5: the ratio the host may size the area to, reported once the
  // level is on screen and again when the level (or its fit) changes.
  const backgroundSize = useImageSize(renderable ? resolveImageUrl(renderable.imageUrl) : null)
  const reportPreferredSize = hostStudentMode ? embed?.reportPreferredSize : undefined
  const levelFit = renderable?.settings.fit ?? null
  const aspectRatio = levelFit ? preferredAspectRatio(levelFit, backgroundSize) : null
  useEffect(() => {
    if (reportPreferredSize && aspectRatio !== null) reportPreferredSize(aspectRatio)
  }, [reportPreferredSize, aspectRatio])

  // Contract v5.5: a student who would see nothing is sent back to the standard
  // course content by the host. Only the student UI reports, and only once the
  // data is in (a failed or pending query says nothing about emptiness).
  const reportNoContent = hostStudentMode ? embed?.reportNoContent : undefined
  const levelNotSaved =
    showPublished && publishedQuery.error instanceof ApiError && publishedQuery.error.status === 404
  // With several levels, one empty level is not the course's whole content: the
  // student is told in the app and can go to another level.
  const onlyLevelIsEmpty =
    renderable !== null && bubbles.length === 0 && !publishedSiblingsQuery.isPending
      ? siblingLevels.length <= 1
      : false
  useEffect(() => {
    if (!reportNoContent) return
    if (levelNotSaved) reportNoContent('no_saved_map')
    else if (onlyLevelIsEmpty) reportNoContent('empty_map')
  }, [reportNoContent, levelNotSaved, onlyLevelIsEmpty])

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

  // The content bubble open in the viewer. "Seen" lives in localStorage and is
  // read on every render; the counter only makes opening one re-render.
  const [openContentId, setOpenContentId] = useState<string | null>(null)
  const [, setSeenTick] = useState(0)
  const widgetsEnabled = useWidgetsEnabled()
  const openContentBubble = openContentId
    ? (bubbles.find((bubble) => bubble.id === openContentId) ?? null)
    : null

  const openContent = (bubble: Bubble) => {
    if (!bubble.content) return
    setOpenContentId(bubble.id)
    // The editor looking at the student view is not a student: leave "seen" alone.
    if (!exitPreview) {
      markContentSeen(viewerStorage(), bubble.id, bubble.content)
      setSeenTick((tick) => tick + 1)
    }
  }

  // A backend that sends `kind` speaks content bubbles (see contentSupport.ts).
  useEffect(() => {
    if (storedRenderable) learnFromBubbles(storedRenderable.bubbles)
  }, [storedRenderable])

  // First visit: the first unseen auto-open content of a level opens by itself,
  // once per level visit, for students only (never the editor's own preview).
  // The welcome curtain goes first: an auto-opening content waits for it to close.
  const welcomeState = useWelcome({
    mapId: renderable?.id ?? null,
    settings: renderable?.settings.welcome,
    isEditorMode: isEditor,
    isPreview: exitPreview !== null,
    noContent: levelNotSaved || onlyLevelIsEmpty,
  })
  // Derived, not an effect: it is shown until the first close handles the level.
  const overlayOpen = useHostOverlayOpen()
  const [autoHandledLevel, setAutoHandledLevel] = useState<string | null>(null)
  const autoCandidate =
    immersive &&
    !exitPreview &&
    !welcomeState.open &&
    courseMapId &&
    !overlayOpen &&
    autoHandledLevel !== courseMapId
      ? ([...bubbles]
          .sort((a, b) => a.sequence - b.sequence)
          .find(
            (bubble) => bubble.content && shouldAutoOpen(viewerStorage(), bubble.id, bubble.content)
          ) ?? null)
      : null
  const shownContentBubble = openContentBubble ?? autoCandidate
  // An auto-opened content counts as seen once it is closed: marking it while it
  // is up would make the candidate vanish on the next render.
  const closeContent = () => {
    if (shownContentBubble?.content && !exitPreview)
      markContentSeen(viewerStorage(), shownContentBubble.id, shownContentBubble.content)
    setOpenContentId(null)
    setAutoHandledLevel(courseMapId)
    setSeenTick((tick) => tick + 1)
  }

  // Editor: the content being written (a new one carries where it will go).
  const contentSupported = useContentSupported()
  const [contentEditor, setContentEditor] = useState<
    { mode: 'create'; x: number; y: number } | { mode: 'edit'; bubbleId: string } | null
  >(null)
  const [contentError, setContentError] = useState<string | null>(null)
  const editedBubble =
    contentEditor?.mode === 'edit'
      ? (bubbles.find((bubble) => bubble.id === contentEditor.bubbleId) ?? null)
      : null
  const closeContentEditor = () => {
    setContentEditor(null)
    setContentError(null)
  }
  const saveContent = (content: Content) => {
    if (!contentEditor) return
    setContentError(null)
    if (contentEditor.mode === 'create') {
      createBubble.mutate(
        { kind: 'content', content, x: contentEditor.x, y: contentEditor.y },
        {
          onSuccess: (bubble) => {
            learnFromCreated(bubble)
            if (bubble.kind === 'content') closeContentEditor()
            else setContentError(es.content.editor.errors.unsupported)
          },
          onError: (error) => {
            if (error instanceof ApiError)
              learnFromCreateFailure({ status: error.status, code: error.detail.code })
            setContentError(contentErrorMessage(error))
            // The dialog says what went wrong; not the activity-placement banner.
            createBubble.reset()
          },
        }
      )
    } else {
      updateBubble.mutate(
        { bubbleId: contentEditor.bubbleId, input: { content } },
        {
          onSuccess: closeContentEditor,
          onError: (error) => setContentError(contentErrorMessage(error)),
        }
      )
    }
  }
  // What the level's other content bubbles weigh against the 1 MB allowance.
  const otherContentBytes = bubbles.reduce(
    (sum, bubble) =>
      bubble.content && bubble.id !== editedBubble?.id ? sum + contentBytes(bubble.content) : sum,
    0
  )

  // In an editor's preview of the student view, a bubble opens nothing in Moodle by itself:
  // it says so, and opening for real is a choice that says what it records.
  const [previewedActivity, setPreviewedActivity] = useState<Activity | null>(null)
  if (previewedActivity && exitPreview === null) setPreviewedActivity(null)
  const handleBubbleClick = (bubble: Bubble) => {
    if (isContentBubble(bubble)) {
      openContent(bubble)
      return
    }
    const resolved = resolvedByBubbleId.get(bubble.id)
    const activity =
      resolved?.activity ?? activities.find((a) => a.activityId === bubble.activityId)
    if (!activity) return
    if (embed && exitPreview !== null) setPreviewedActivity(activity)
    else openActivity(activity)
  }

  // Student presentation only (MapCanvas forces this to null in edit mode):
  // joins GET .../resolved against the map's own bubbles to decide whether a
  // bubble can be opened, replacing the old "is it in the live activities
  // list" heuristic with the precise available/hidden/missing/unknown states
  // from the backend.
  const getUnavailableReason = (bubble: Bubble): string | null => {
    if (isContentBubble(bubble)) return null
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

  // Content is information: always there, whatever Moodle says.
  const getAvailabilityForBubble = (bubble: Bubble) =>
    isContentBubble(bubble) || simCompleted
      ? 'available'
      : resolvedByBubbleId.get(bubble.id)?.availability
  useCompletionNotices({
    levelKey: courseMapId,
    ready: !moodle.resolvedPending && !moodle.resolvedError,
    bubbles,
    // A teaser has no activity behind it, so its name is never spoken.
    nameOf: (bubble) => resolvedByBubbleId.get(bubble.id)?.activity?.name ?? null,
    // A simulation's made-up completions are nothing to tell anyone about.
    enabled: !isEditor && !simulating,
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
  const tutorAvailable = useHostTutorAvailable()
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
    seenOf: (bubble) =>
      bubble.content ? isContentSeen(viewerStorage(), bubble.id, bubble.content) : false,
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
  // Editors and the preview are told when the music file is missing; students
  // never are (their control just does not appear).
  const audioDiagnostics = exitPreview !== null || embed?.mode === 'editor'
  const audioMissing = audio?.info.available === false
  const audioTrack = useMemo<AudioTrack | null>(
    () =>
      audio && (!audioMissing || audioDiagnostics)
        ? {
            assetId: audio.settings.assetId,
            url: resolveImageUrl(`/assets/${audio.settings.assetId}`),
            loop: audio.settings.loop,
            volume: audio.settings.volume,
            startAfterInteraction: audio.settings.startAfterInteraction,
            title: audio.info.title,
            credit: audio.info.credit,
            license: audio.info.license?.trim() || null,
            coverUrl: audio.info.coverUrl ? resolveCoverUrl(audio.info.coverUrl) : null,
            unavailable: audioMissing,
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
      audio?.info.license,
      audio?.info.coverUrl,
      audioMissing,
      audioDiagnostics,
    ]
  )
  // The welcome curtain: once per viewer and map; never to an editor editing.
  const hostCourseName = useHostCourseName()
  const curtainFullscreen = useFullscreenEntry(embed)
  const flowGate = welcomeState.flow
  const flowSteps = welcomeState.welcome.steps
  const audioForWelcome = audioTrack
    ? {
        title: audioTrack.title,
        coverUrl: audioTrack.coverUrl,
        startAfterInteraction: audioTrack.startAfterInteraction,
      }
    : null
  // A configured flow takes the place of the legacy curtain. While the host is
  // asked where the progress is (up to 3 s) the stage is covered, so the map does
  // not flash before the flow.
  const welcomeCurtain =
    flowGate && flowSteps && renderable ? (
      flowGate.state.status === 'run' ? (
        <LazyWelcomeFlow
          key={`${renderable.id}:${flowGate.state.mode}`}
          steps={flowSteps}
          mode={flowGate.state.mode}
          entries={flowGate.state.entries}
          persistence={flowGate.state.persistence}
          documents={renderable.welcomeDocuments ?? []}
          courseName={hostCourseName?.trim() || renderable.title}
          imageUrl={renderable.imageUrl}
          hasMusic={audioTrack !== null}
          track={audioForWelcome}
          onEnterFullscreen={curtainFullscreen}
          onFinish={flowGate.finish}
        />
      ) : flowGate.state.status === 'checking' ? (
        <div className="absolute inset-0 z-50 bg-ink" />
      ) : null
    ) : welcomeState.open && renderable ? (
      <LazyWelcomeCurtain
        key={renderable.id}
        welcome={welcomeState.welcome}
        title={welcomeTitle(welcomeState.welcome, es.welcome.defaultTitle, {
          courseName: hostCourseName,
          mapTitle: renderable.title,
        })}
        imageUrl={renderable.imageUrl}
        hasMusic={audioTrack !== null}
        track={
          audioTrack
            ? {
                title: audioTrack.title,
                coverUrl: audioTrack.coverUrl,
                startAfterInteraction: audioTrack.startAfterInteraction,
              }
            : null
        }
        onEnterFullscreen={curtainFullscreen}
        showSkip={exitPreview !== null}
        onDone={welcomeState.dismiss}
      />
    ) : null
  // The practice trainer: its button shows only when the map has one, and its state
  // comes from the catalog (loading, empty, failed, or ready). Until the welcome flow
  // is finished it is disabled with the reason (a convention, never a lock); an editor
  // looking at the student view is never held by the flow.
  const [trainerOpen, setTrainerOpen] = useState(false)
  const trainerOn = Boolean(renderable?.settings.trainer?.enabled)
  const welcomePending =
    flowGate !== null && (flowGate.state.status === 'run' || flowGate.state.status === 'checking')
  const trainerCatalog = useCatalog(trainerOn && immersive)
  // An editor looking at the student view, by the app's own preview or by the server's
  // word (the catalog says `preview` for someone who can edit).
  const trainerViewerIsEditor = exitPreview !== null || trainerCatalog.data?.preview === true
  const trainerState = entryState({
    status: trainerCatalog.status,
    catalog: trainerCatalog.data,
    failure: trainerCatalog.isError ? classifyFailure(trainerCatalog.error) : undefined,
    welcomePending,
    isEditor: trainerViewerIsEditor,
  })
  const trainerReason = entryReason(trainerState)
  const closeTrainer = () => setTrainerOpen(false)
  // The HUD is inert while the stage is open: when it closes, the focus goes back to
  // the "Entrenar" button (after the HUD is live again).
  const trainerWasOpen = useRef(false)
  useEffect(() => {
    if (trainerOpen) {
      trainerWasOpen.current = true
      return
    }
    if (!trainerWasOpen.current) return
    trainerWasOpen.current = false
    document.getElementById(TRAINER_BUTTON_ID)?.focus()
  }, [trainerOpen])
  // The closing flow. A student has no button into it: the journey brings them (see
  // closingResume.ts), worked out again on every load. It is never opened over the map for a
  // student who has not started it. Its steps come from the map.
  const closingSteps = renderable?.settings.closing?.enabled
    ? (renderable.settings.closing.steps ?? NO_STEPS)
    : NO_STEPS
  // Students only: an editor's preview never asks, and the simulation has its own.
  const studentJourney =
    embed !== null && immersive && exitPreview === null && closingSteps.length > 0
  const realStatus = useClosingStatus(studentJourney).data ?? null
  const closingProgress = useClosingProgress({
    mapId: renderable?.id ?? null,
    steps: closingSteps,
    enabled: studentJourney,
    embed,
  })
  const simRules = simRulesOf(renderable?.settings ?? NO_SETTINGS)
  const simWelcome = simWelcomeSteps(
    renderable?.settings.welcome,
    esCongratulations.simulator.checkinTitle
  )
  const closingStatus = sim
    ? simStatus(sim, simRules, bubbles.filter((bubble) => !isContentBubble(bubble)).length)
    : realStatus
  // What an exam step of a simulated flow reads and writes.
  const flowSimulation: FlowSimulation | null = sim
    ? {
        rules: simRules,
        checkin: sim.checkin,
        attempts: sim.attempts,
        onSimulate: (purpose, outcome) =>
          updateSim((state) =>
            purpose === 'check_in'
              ? simCheckin(state, outcome)
              : simAttempt(state, outcome, simRules)
          ),
      }
    : null
  // The entry is offered where there is a journey to play: a closing, or a welcome check-in.
  const simOffered =
    canSimulate && renderable !== null && (closingSteps.length > 0 || !simWelcome.addedCheckin)
  const startSimulation = () => {
    if (courseMapId === null) return
    // The preview's own welcome gives way to the simulated one.
    welcomeState.dismiss()
    clearJourney()
    setSimRun({ level: courseMapId, state: initialSim() })
  }
  // A new run: nothing open, no result and no attempt left from the one before.
  const resetSimulation = () => {
    clearJourney()
    updateSim((state) => initialSim(state.run + 1))
  }
  const exitSimulation = () => {
    clearJourney()
    setSimRun(null)
  }
  const queryClient = useQueryClient()
  // Finishing an activity changes the backend's answer, and the host announces it with a fresh
  // state: ask again then (the status is cheap and the server owns what it means).
  useEffect(
    () =>
      subscribeHostStateReceived(
        () => void queryClient.invalidateQueries({ queryKey: CLOSING_STATUS_KEY })
      ),
    [queryClient]
  )
  const journeySteps = closingStepsFor(closingSteps, closingStatus)
  const welcomeBusy = sim
    ? sim.phase === 'welcome'
    : flowGate !== null && flowGate.state.status !== 'closed' && flowGate.state.status !== 'off'
  // A simulation plays the welcome flow of its own, with the check-in in it.
  const stageCurtain = !sim ? (
    welcomeCurtain
  ) : sim.phase === 'welcome' && renderable ? (
    <LazyWelcomeFlow
      key={`${renderable.id}:sim:${sim.run}`}
      steps={simWelcome.steps}
      mode="preview"
      entries={[]}
      persistence={null}
      documents={renderable.welcomeDocuments ?? []}
      courseName={hostCourseName?.trim() || renderable.title}
      imageUrl={renderable.imageUrl}
      hasMusic={false}
      simulation={flowSimulation}
      onFinish={() => updateSim(simWelcomeDone)}
    />
  ) : null
  // The simulation keeps no progress: its closing counts as done once it was entered from the
  // congratulations.
  const closingFlowState: ClosingFlowState = simulating
    ? journeyDismissed.includes('congrats_checkin')
      ? 'finished'
      : 'not_started'
    : closingFlowStateOf(journeySteps, closingProgress.entries)
  const closingPlace =
    renderable && journeySteps.length > 0
      ? closingPlaceOf({
          status: closingStatus,
          flow: closingFlowState,
          seen: (screen) =>
            journeyDismissed.includes(screen) ||
            (!simulating && wasScreenSeen(viewerStorage(), renderable.id, screen)),
        })
      : null
  const journeyBlocked = welcomeBusy || trainerOpen
  // A flow left in the middle opens again. Kept as state, so a status that changes while the
  // student is inside (the final just passed) does not take the flow away from them.
  if (closingPlace?.kind === 'resume' && !closingOpen && !journeyBlocked) setClosingOpen(true)
  const journeyScreen: JourneyScreen | null =
    closingPlace?.kind === 'screen' && !closingOpen && !journeyBlocked ? closingPlace.screen : null
  const showClosingCard = closingPlace?.kind === 'card' && !closingOpen && !journeyBlocked
  const showRouteCard =
    closingPlace?.kind === 'route' &&
    !journeyDismissed.includes('route') &&
    !closingOpen &&
    !journeyBlocked
  const simFailed = sim ? simLastFailure(sim, simRules) : null
  // The closing or a journey screen has the stage: what opens by itself on a level waits.
  const stageTaken = closingOpen || journeyScreen !== null
  const finishJourneyScreen = () => {
    if (!journeyScreen || !renderable) return
    // The congratulations come once per browser; the "attempts spent" screen once per visit.
    if (!simulating && journeyScreen !== 'exhausted')
      markScreenSeen(viewerStorage(), renderable.id, journeyScreen)
    setJourneyDismissed((list) => [...list, journeyScreen])
    // The CTA of a passed check-in opens the closing flow, without the final exam.
    if (journeyScreen === 'congrats_checkin') setClosingOpen(true)
  }
  // The HUD's "Cierre" button is the editor's alone, to look at the flow from the student view.
  // Not while simulating: the journey is the way in then, as it is for a student.
  const editorSeesClosing =
    !simulating && exitPreview !== null && (embed === null || embed.role === 'editor')
  const closingWasOpen = useRef(false)
  useEffect(() => {
    if (closingOpen) {
      closingWasOpen.current = true
      return
    }
    if (!closingWasOpen.current) return
    closingWasOpen.current = false
    // A student has no closing button: the focus goes back to the HUD.
    const back =
      document.getElementById(CLOSING_BUTTON_ID) ?? document.getElementById(QUESTS_BUTTON_ID)
    back?.focus()
  }, [closingOpen])
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
  const getModname = (bubble: { activityId: number | null }) =>
    bubble.activityId === null
      ? undefined
      : activities.find((a) => a.activityId === bubble.activityId)?.modname

  const handleSelectBubbleFromOverview = (bubble: Bubble) => {
    setSection('map')
    setFocusBubbleId(bubble.id)
  }

  // 3D is for students and the editor's preview; editing stays on the 2D map.
  const view3d = renderable?.view3d ?? null
  const show3d = !isEditor && view3d !== null && mapView === '3d'
  const camera3d = useSyncExternalStore(cameraBridge.subscribeState, cameraBridge.getState)

  // The teacher's heat map: completion counts the host computes, drawn over the
  // 2D map. Only an editor whose host is in editing mode (and so can answer);
  // never for students. The numbers live in memory while it is on.
  const heatAvailable =
    embed?.role === 'editor' && embed.mode === 'editor' && courseMapId !== null && !show3d
  const [heatWanted, setHeatWanted] = useState(() => chosenSection === 'heat')
  const heatOn = heatAvailable && heatWanted
  const [heatOverlay, setHeatOverlay] = useState<ReadonlyMap<string, BubbleHeat> | null>(null)
  const heatSteps = useMemo<StepInput[]>(
    () =>
      heatOn
        ? bubbles.flatMap((bubble) =>
            bubble.activityId === null || isContentBubble(bubble)
              ? []
              : [
                  {
                    bubbleId: bubble.id,
                    cmid: bubble.activityId,
                    name:
                      resolvedByBubbleId.get(bubble.id)?.activity?.name ?? `#${bubble.activityId}`,
                    sequence: bubble.sequence,
                  },
                ]
          )
        : [],
    [heatOn, bubbles, resolvedByBubbleId]
  )

  const placeActivity = (activityId: number, x: number, y: number) => {
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
  }

  // The map is not on screen while the list is, so a row places itself: spread over the
  // level, so several placed in a row do not pile up on one spot.
  const placeFromList = (activity: Activity) => {
    const n = bubbles.length
    const { x, y } = spreadPlacement(n)
    placeActivity(activity.activityId, x, y)
    toast.show(es.shell.placed(activity.name), 'success')
  }

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

    if (hostStudentMode && bubbles.length === 0 && siblingLevels.length > 1) {
      return (
        <div className="space-y-3 p-4" role="status">
          <p className="font-heading text-lg font-semibold text-ink">{es.student.emptyLevel}</p>
          <p className="text-sm text-ink-soft">{es.student.emptyLevelHint}</p>
          <Button variant="secondary" onClick={() => navigate({ name: 'home' })}>
            {es.app.backToHome}
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
            configureCompletion
              ? (bubble) => {
                  if (bubble.activityId !== null) configureCompletion(bubble.activityId)
                }
              : undefined
          }
          heat={heatOn ? (heatOverlay ?? undefined) : undefined}
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
          onContentDrop={
            contentSupported ? (x, y) => setContentEditor({ mode: 'create', x, y }) : undefined
          }
          onEditContent={(bubble) => setContentEditor({ mode: 'edit', bubbleId: bubble.id })}
          onActivityDrop={placeActivity}
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
    onAddContent: contentSupported
      ? () => setContentEditor({ mode: 'create', x: 0.5, y: 0.5 })
      : undefined,
  }

  // Embedded in student mode there is no mode switch: only the saved map is shown.
  const headerViewMode = hostStudentMode ? undefined : viewMode
  // Embedded, "home" is the course's level picker; with a single level there is
  // nowhere to go back to.
  const goHome = embed && siblingLevels.length <= 1 ? undefined : () => navigate({ name: 'home' })

  // Sections this editor can open (the heat map needs the host; levels need a course).
  const availableSections = sectionsFor({ heat: heatAvailable, levels: moodleCourseId !== null })
  const section = resolveSection(chosenSection, availableSections)
  const railItems: RailItem[] = availableSections.map((id) => ({
    id,
    badge: id === 'activities' ? unplacedCount : undefined,
    attention: id === 'appearance' ? appearanceDirty : undefined,
  }))
  const openLevel = (id: string) => {
    setSection('map')
    navigate({ name: 'map', mapId: id })
  }
  const toggleFullscreenOnOpen = () => {
    rememberFullscreenOnOpen(!fullscreenOnOpen, viewerStorage())
    setFullscreenOnOpen(!fullscreenOnOpen)
  }

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
            transferMenu={
              isEditor ? (
                <TransferMenu
                  moodleCourseId={route.moodleCourseId}
                  onOpenLevel={(id) => navigate({ name: 'map', mapId: id })}
                />
              ) : undefined
            }
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

  const mapPane = (
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
          {heatAvailable && !isEditor && (
            <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex w-[min(22rem,calc(100%-1.5rem))] flex-col items-start gap-2">
              {heatOn ? (
                <div className="pointer-events-auto w-full">
                  <LazyHeatmapPanel
                    steps={heatSteps}
                    onOverlay={setHeatOverlay}
                    onHide={() => setHeatWanted(false)}
                    onConfigure={configureCompletion}
                  />
                </div>
              ) : (
                // The editor's own header has the switch; the preview has no header.
                !isEditor && (
                  <Button
                    variant="surface"
                    size="sm"
                    className="pointer-events-auto"
                    aria-pressed={false}
                    onClick={() => setHeatWanted(true)}
                  >
                    <Flame size={16} strokeWidth={2.5} aria-hidden />
                    {es.heatmap.toggle}
                  </Button>
                )
              )}
            </div>
          )}
          {immersive && renderable ? (
            <>
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
                coachMarks={!exitPreview && !shownContentBubble && !stageTaken}
                questsOpen={questsOpen}
                onToggleQuests={toggleQuests}
                trainer={
                  trainerOn && trainerState.kind !== 'hidden'
                    ? {
                        onOpen: () => setTrainerOpen(true),
                        mode: entryMode(trainerState),
                        note: trainerReason ? es.hud.trainerNote[trainerReason] : null,
                        persistentNote: noteIsPersistent(trainerState, trainerViewerIsEditor),
                      }
                    : null
                }
                tutor={
                  embed && tutorAvailable
                    ? { kind: 'ready', onOpen: embed.openTutor }
                    : embed && exitPreview
                      ? { kind: 'not-enabled' }
                      : null
                }
                closing={
                  editorSeesClosing && journeySteps.length > 0
                    ? { onOpen: () => setClosingOpen(true) }
                    : null
                }
                overlay={
                  trainerOpen && renderable ? (
                    <LazyTrainerStage imageUrl={renderable.imageUrl} onClose={closeTrainer} />
                  ) : closingOpen && renderable && journeySteps.length > 0 ? (
                    <LazyWelcomeFlow
                      key={`${renderable.id}:closing:${sim?.run ?? 'real'}`}
                      simulation={flowSimulation}
                      flowKey="closing"
                      steps={journeySteps}
                      mode={exitPreview !== null ? 'preview' : 'normal'}
                      entries={
                        exitPreview !== null
                          ? []
                          : entriesToOpenWith(
                              closingStatus,
                              journeySteps,
                              closingProgress.entries ?? []
                            )
                      }
                      persistence={exitPreview !== null ? null : closingProgress.persistence}
                      documents={renderable.welcomeDocuments ?? []}
                      courseName={hostCourseName?.trim() || renderable.title}
                      imageUrl={renderable.imageUrl}
                      hasMusic={false}
                      onFinish={(done) => {
                        setClosingOpen(false)
                        if (exitPreview === null) closingProgress.finish(done)
                        void queryClient.invalidateQueries({ queryKey: CLOSING_STATUS_KEY })
                      }}
                    />
                  ) : journeyScreen && renderable ? (
                    <JourneyOverlay
                      screen={journeyScreen}
                      congratulations={renderable.settings.congratulations}
                      status={closingStatus}
                      onContinue={finishJourneyScreen}
                      simulated={simulating}
                      finalThreshold={sim ? simRules.policy.pass_percent : null}
                    />
                  ) : null
                }
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
                    ? {
                        zoomIn: () => cameraBridge.command('zoom-in'),
                        zoomOut: () => cameraBridge.command('zoom-out'),
                        recenter: () => cameraBridge.command('reset'),
                        canZoomIn: camera3d.canZoomIn,
                        canZoomOut: camera3d.canZoomOut,
                        recenterLabel: es.hud.resetView,
                      }
                    : {
                        zoomIn: () => mapControlsRef.current?.zoomIn(),
                        zoomOut: () => mapControlsRef.current?.zoomOut(),
                        recenter: () => mapControlsRef.current?.recenter(),
                      }
                }
                reportInsets={show3d}
                curtain={stageCurtain}
                onShowWelcome={welcomeState.reopen}
                audio={
                  audioTrack ? (
                    <LazyAudioControl track={audioTrack} diagnostics={audioDiagnostics} />
                  ) : null
                }
                onEnterFullscreen={
                  embed && !isFullscreen ? () => embed.requestFullscreen(true) : null
                }
                continueAction={continueAction}
                exitPreview={exitPreview}
                embedded={Boolean(embed)}
              >
                {(layout) => (show3d && view3d ? render3d(view3d) : renderMapArea(layout))}
              </StudentStage>
              {simOffered && (
                <JourneySimulator
                  state={sim}
                  rules={simRules}
                  addedCheckin={simWelcome.addedCheckin}
                  hasClosing={closingSteps.length > 0}
                  closingOpen={closingOpen}
                  onStart={startSimulation}
                  onAllDone={() => updateSim((state) => simAllDone(state, simRules))}
                  onAttempt={(outcome) =>
                    updateSim((state) => simAttempt(state, outcome, simRules))
                  }
                  onReset={resetSimulation}
                  onExit={exitSimulation}
                />
              )}
              {closingStatus && showClosingCard && (
                <ClosingCard
                  status={closingStatus}
                  failure={
                    simFailed === null ? null : finalFailure(simFailed, simRules.finalMaxAttempts)
                  }
                  onOpen={() => setClosingOpen(true)}
                />
              )}
              <ConfirmDialog
                open={previewedActivity !== null}
                onOpenChange={(open) => !open && setPreviewedActivity(null)}
                title={previewedActivity?.name ?? ''}
                description={es.flow.previewActivity.placeholder}
                confirmLabel={es.flow.previewActivity.openForReal}
                cancelLabel={es.flow.previewActivity.close}
                destructive={false}
                onConfirm={() => {
                  if (previewedActivity) openActivity(previewedActivity)
                  setPreviewedActivity(null)
                }}
              />
              {showRouteCard && (
                <RouteCard onDismiss={() => setJourneyDismissed((list) => [...list, 'route'])} />
              )}
            </>
          ) : show3d && renderable && view3d ? (
            render3d(view3d)
          ) : (
            renderMapArea()
          )}
        </div>
      </main>
    </div>
  )

  const sectionPanels = {
    activities: (
      <ScrollRegion memoryKey="activities" active={section === 'activities'} className="p-3 sm:p-4">
        <ActivitySidebar
          {...sidebarProps}
          onPlace={placeFromList}
          className="flex min-w-0 flex-col"
        />
      </ScrollRegion>
    ),
    levels:
      moodleCourseId !== null ? (
        <ScrollRegion memoryKey="levels" active={section === 'levels'} className="p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <TransferMenu moodleCourseId={moodleCourseId} onOpenLevel={openLevel} />
          </div>
          <CourseLevels
            embedded
            moodleCourseId={moodleCourseId}
            viewMode={viewMode}
            onOpenLevel={openLevel}
          />
        </ScrollRegion>
      ) : null,
    heat: heatAvailable ? (
      <ScrollRegion memoryKey="heat" active={section === 'heat'} className="p-3 sm:p-4">
        {heatOn ? (
          <LazyHeatmapPanel
            steps={heatSteps}
            onOverlay={setHeatOverlay}
            onHide={() => {
              setHeatWanted(false)
              setSection('map')
            }}
            onConfigure={configureCompletion}
          />
        ) : (
          <Button variant="surface" size="sm" onClick={() => setHeatWanted(true)}>
            <Flame size={16} strokeWidth={2.5} aria-hidden />
            {es.heatmap.toggle}
          </Button>
        )}
      </ScrollRegion>
    ) : null,
    appearance: draftQuery.data ? (
      <Suspense fallback={null}>
        <AppearanceStudio
          courseMap={draftQuery.data}
          skins={skinsQuery.data?.items ?? []}
          activities={activities}
          active={section === 'appearance'}
          getCurrentView={() => latestViewportRef.current}
          onClose={() => setSection('map')}
          onDirtyChange={setAppearanceDirty}
          onChangeBackground={() => setIsBackgroundPickerOpen(true)}
          onPreview3d={() => {
            // The draft as a student would see it, in 3D.
            setSection('map')
            setViewMode('preview')
            changeMapView('3d')
          }}
        />
      </Suspense>
    ) : null,
    summary: (
      <ScrollRegion memoryKey="summary" active={section === 'summary'} className="p-3 sm:p-4">
        <ActivitiesOverviewBody
          bubbles={bubbles}
          activities={activities}
          mode={renderable?.settings.mode ?? 'explorative'}
          view="editor"
          getAvailability={getAvailabilityForBubble}
          onSelectBubble={handleSelectBubbleFromOverview}
          onConfigureCompletion={configureCompletion}
        />
      </ScrollRegion>
    ),
  }

  return (
    <div className={`flex ${shellHeight} flex-col`}>
      {isEditor ? (
        <EditorShell
          home={goHome}
          mapTitle={renderable?.title}
          levelNav={
            prevLevel || nextLevel ? (
              <div className="flex shrink-0 items-center max-[760px]:hidden">
                <IconButton
                  aria-label={
                    prevLevel ? `${es.levels.prevLevel}: ${prevLevel.title}` : es.levels.prevLevel
                  }
                  variant="ghost"
                  disabled={!prevLevel}
                  onClick={prevLevel ? () => openLevel(prevLevel.id) : undefined}
                >
                  <ChevronLeft size={16} />
                </IconButton>
                <IconButton
                  aria-label={
                    nextLevel ? `${es.levels.nextLevel}: ${nextLevel.title}` : es.levels.nextLevel
                  }
                  variant="ghost"
                  disabled={!nextLevel}
                  onClick={nextLevel ? () => openLevel(nextLevel.id) : undefined}
                >
                  <ChevronRight size={16} />
                </IconButton>
              </div>
            ) : undefined
          }
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          publication={
            courseMapId ? (
              <PublicationBar
                courseMapId={courseMapId}
                isSaving={isSaving}
                menuExtra={
                  embed?.mode === 'editor'
                    ? [
                        {
                          label: es.shell.fullscreenOnOpen,
                          icon: <Maximize2 size={16} strokeWidth={2.5} aria-hidden />,
                          checked: fullscreenOnOpen,
                          onSelect: toggleFullscreenOnOpen,
                        },
                      ]
                    : []
                }
              />
            ) : null
          }
          onFullscreen={curtainFullscreen}
          reservedCorner={isFullscreen ? RESERVED_CORNER_PX : null}
          items={railItems}
          section={section}
          onSectionChange={setSection}
          sections={sectionPanels}
          map={mapPane}
        />
      ) : (
        mapPane
      )}

      {isEditor && contentEditor && (contentEditor.mode === 'create' || editedBubble) && (
        <LazyContentEditor
          key={editedBubble?.id ?? 'new'}
          initial={editedBubble?.content ?? null}
          widgetsEnabled={widgetsEnabled}
          otherBytes={otherContentBytes}
          saving={createBubble.isPending || updateBubble.isPending}
          error={contentError}
          onSave={saveContent}
          onCancel={closeContentEditor}
        />
      )}

      <LazyContentViewer
        content={stageTaken ? null : (shownContentBubble?.content ?? null)}
        widgetsEnabled={widgetsEnabled}
        onClose={closeContent}
      />

      <ActivityModal activity={selectedActivity} onClose={() => setSelectedActivity(null)} />

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
  transferMenu,
  heatToggle,
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
  // Export and import of levels (editor only).
  transferMenu?: ReactNode
  // The teacher's heat map switch (editor only).
  heatToggle?: ReactNode
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
        {transferMenu}
        {heatToggle}
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
