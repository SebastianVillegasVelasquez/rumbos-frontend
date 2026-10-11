import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, List, Loader2, RefreshCw } from "lucide-react";
import { ActivitySidebar } from "./features/course-map/components/ActivitySidebar.tsx";
import { ActivityModal } from "./features/course-map/components/ActivityModal.tsx";
import { ActivitiesOverviewModal } from "./features/course-map/components/ActivitiesOverviewModal.tsx";
import { MapsHome } from "./features/course-map/components/MapsHome.tsx";
import { CourseLevels } from "./features/course-map/components/CourseLevels.tsx";
import { StudentHud } from "./features/course-map/components/StudentHud.tsx";
import { WriteSyncHost } from "./features/course-map/components/WriteSyncHost.tsx";
import { PublicationBar } from "./features/course-map/components/publication/PublicationBar.tsx";
import { LazyBackgroundPicker } from "./features/course-map/components/background/LazyBackgroundPicker.tsx";
import { useChangeBackground } from "./features/course-map/components/background/useChangeBackground.ts";
import { rememberCourseMap } from "./features/course-map/data/recentMaps.ts";
import {
    ACTIVITY_OPEN_MODE,
    createActivityOpener,
    isSafeActivityUrl,
} from "./features/course-map/activityOpener.ts";
import {
    useActivities,
    useCourseMap,
    useCourseMapsByCourse,
    useCreateBubble,
    usePendingActivityIds,
    usePublicationState,
    usePublishedCourseMap,
    usePublishedMapsByCourse,
    usePublishedResolvedCourseMap,
    useResolvedCourseMap,
    useSkins,
} from "./features/course-map/data/queries.ts";
import { useDeleteBubble, useUpdateBubble } from "./features/course-map/data/draftMutations.ts";
import { isWriteDiscarded } from "./features/course-map/data/writeQueue.ts";
import { ApiError, isPreconditionRequired, isUnreachable } from "./features/course-map/data/client.ts";
import { resolveImageUrl } from "./features/course-map/data/assets.ts";
import { courseTitleFrom } from "./features/course-map/courseTitle.ts";
import { draftToRenderable, publishedToRenderable } from "./features/course-map/renderable.ts";
import type { Activity, MapInitialView, RenderableBubble as Bubble, ResolvedBubble } from "./features/course-map/data/types.ts";
import { useRoute } from "./hooks/useRoute.ts";
import { Wordmark } from "./components/Logo.tsx";
import { Button, IconButton } from "./components/ui/Button.tsx";
import { SegmentedControl } from "./components/ui/SegmentedControl.tsx";
import { ToastProvider } from "./components/ui/Toast.tsx";
import { useToast } from "./components/ui/toastContext.ts";
import { es } from "./i18n/es.ts";
import { FpsMeter } from "./fx/FpsMeter.tsx";
import { isFpsDebugEnabled } from "./fx/debug.ts";

// Edición: the draft, editable. Vista previa: the draft shown as a student
// would see it. Publicado: the published version, exactly what students get.
type ViewMode = "edit" | "preview" | "published";

// A link with ?view=published opens the student experience directly. There is
// no authentication yet, so this stands in for the student entry point.
const initialViewMode = (): ViewMode =>
    new URLSearchParams(window.location.search).get("view") === "published" ? "published" : "edit";

// Konva (and its React bindings) is only needed once a map is actually open,
// so it's kept out of the "Mis mapas" home bundle.
const MapCanvas = lazy(() =>
    import("./features/course-map/components/MapCanvas.tsx").then((m) => ({ default: m.MapCanvas }))
);
// Also Konva-heavy (skin previews render through the same BubbleVisual/Stage
// machinery as the canvas), so it's lazy for the same reason.
const AppearanceStudio = lazy(() =>
    import("./features/course-map/components/AppearanceStudio.tsx").then((m) => ({ default: m.AppearanceStudio }))
);

document.title = `${es.app.wordmark} — ${es.home.title}`;

function App() {
    return (
        <ToastProvider>
            <AppShell />
            <WriteSyncHost />
            {isFpsDebugEnabled() && <FpsMeter />}
        </ToastProvider>
    );
}

function AppShell() {
    const toast = useToast();
    const [route, navigate] = useRoute();
    const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
    const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [isActivitiesOverviewOpen, setIsActivitiesOverviewOpen] = useState(false);
    const [focusBubbleId, setFocusBubbleId] = useState<string | null>(null);
    const [cachedNoticeDismissed, setCachedNoticeDismissed] = useState(false);
    const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);
    const [isBackgroundPickerOpen, setIsBackgroundPickerOpen] = useState(false);
    // Written on every MapCanvas viewport tick (see onViewportChange below),
    // read once when the appearance studio's "usar vista actual" is clicked -
    // a ref, not state, so panning/zooming never re-renders AppShell.
    const latestViewportRef = useRef<MapInitialView | null>(null);

    const isEditor = viewMode === "edit";
    const showPublished = viewMode === "published";

    const courseMapId = route.name === "map" ? route.mapId : null;
    // Draft and published data use separate queries; only the one for the
    // current view mode is enabled.
    const draftId = showPublished ? null : courseMapId;
    const publishedId = showPublished ? courseMapId : null;

    const draftQuery = useCourseMap(draftId);
    const publishedQuery = usePublishedCourseMap(publishedId);
    const mapQuery = showPublished ? publishedQuery : draftQuery;
    // Always unfiltered: besides the sidebar, this also backs icon/modname
    // lookups for every bubble on the map, which can come from any section.
    // onlySection is applied client-side, just for the sidebar's own list -
    // see ActivitySidebar's sectionFilter prop.
    const activitiesQuery = useActivities(draftId, isEditor, false);
    const draftResolved = useResolvedCourseMap(draftId, isEditor);
    const publishedResolved = usePublishedResolvedCourseMap(publishedId, false);
    const resolvedQuery = showPublished ? publishedResolved : draftResolved;
    const publicationState = usePublicationState(draftId);
    const createBubble = useCreateBubble(courseMapId ?? "");
    const updateBubble = useUpdateBubble(courseMapId ?? "");
    const deleteBubble = useDeleteBubble(courseMapId ?? "");
    const pendingActivityIds = usePendingActivityIds(courseMapId ?? "");
    const skinsQuery = useSkins();
    const changeBackground = useChangeBackground(courseMapId ?? "");

    // The one shape the canvas, HUD and skin resolution consume, whichever
    // side it came from.
    const renderable = useMemo(() => {
        if (showPublished) return publishedQuery.data ? publishedToRenderable(publishedQuery.data) : null;
        return draftQuery.data ? draftToRenderable(draftQuery.data, skinsQuery.data?.items ?? []) : null;
    }, [showPublished, publishedQuery.data, draftQuery.data, skinsQuery.data]);

    // Siblings of the currently-open level, for the breadcrumb and prev/next
    // navigation - only meaningful once we know which course this map
    // belongs to, so it's fetched off the map query, not the route.
    const moodleCourseId = renderable?.moodleCourseId ?? null;
    const draftSiblingsQuery = useCourseMapsByCourse(showPublished ? null : moodleCourseId);
    const publishedSiblingsQuery = usePublishedMapsByCourse(showPublished ? moodleCourseId : null);
    const siblingsData = showPublished ? publishedSiblingsQuery.data : draftSiblingsQuery.data;
    const siblingLevels = useMemo(() => siblingsData ?? [], [siblingsData]);
    const currentLevelIndex = siblingLevels.findIndex((level) => level.id === courseMapId);
    const prevLevel = currentLevelIndex > 0 ? siblingLevels[currentLevelIndex - 1] : null;
    const nextLevel =
        currentLevelIndex !== -1 && currentLevelIndex < siblingLevels.length - 1 ? siblingLevels[currentLevelIndex + 1] : null;

    useEffect(() => {
        if (draftQuery.data) rememberCourseMap(draftQuery.data);
    }, [draftQuery.data]);

    useEffect(() => {
        document.title = renderable ? `${renderable.title} — ${es.app.wordmark}` : `${es.app.wordmark} — ${es.home.title}`;
    }, [renderable]);

    const resolvedBubbles = resolvedQuery.data?.bubbles;
    // The published API has no activities endpoint: students get each
    // activity through /resolved instead.
    const activities = useMemo(() => {
        if (showPublished) return (resolvedBubbles ?? []).flatMap((rb) => (rb.activity ? [rb.activity] : []));
        return activitiesQuery.data ?? [];
    }, [showPublished, resolvedBubbles, activitiesQuery.data]);
    const bubbles = useMemo(() => renderable?.bubbles ?? [], [renderable]);
    const unplacedCount = activities.filter((activity) => !activity.placed).length;

    const resolvedByBubbleId = useMemo(
        () => new Map<string, ResolvedBubble>((resolvedBubbles ?? []).map((rb) => [rb.bubbleId, rb])),
        [resolvedBubbles]
    );
    const moodleStatus = resolvedQuery.data?.moodleStatus ?? null;

    const isSaving = updateBubble.isPending || createBubble.isPending || deleteBubble.isPending;

    // A write the user was already told about (conflict dialog / toast) is not
    // an error to repeat in the banner.
    const realError = (error: unknown) => (isWriteDiscarded(error) ? null : error);
    const saveFailure = realError(updateBubble.error)
        ? { message: es.app.saveReverted, error: updateBubble.error }
        : createBubble.isError
          ? { message: es.app.placeActivityError, error: createBubble.error }
          : realError(deleteBubble.error)
            ? { message: es.app.deleteBubbleError, error: deleteBubble.error }
            : null;
    const saveErrorMessage = saveFailure
        ? isPreconditionRequired(saveFailure.error)
            ? es.conflict.clientBug
            : isUnreachable(saveFailure.error)
              ? `${saveFailure.message} ${es.app.unreachableServer}`
              : saveFailure.message
        : null;

    const dismissSaveError = () => {
        updateBubble.reset();
        createBubble.reset();
        deleteBubble.reset();
    };

    const openActivity = useMemo(
        () => createActivityOpener(ACTIVITY_OPEN_MODE, setSelectedActivity),
        []
    );

    const handleBubbleClick = (bubble: Bubble) => {
        const resolved = resolvedByBubbleId.get(bubble.id);
        const activity = resolved?.activity ?? activities.find((a) => a.activityId === bubble.activityId);
        if (activity) openActivity(activity);
    };

    // Student presentation only (MapCanvas forces this to null in edit mode):
    // joins GET .../resolved against the map's own bubbles to decide whether a
    // bubble can be opened, replacing the old "is it in the live activities
    // list" heuristic with the precise available/hidden/missing/unknown states
    // from the backend.
    const getUnavailableReason = (bubble: Bubble): string | null => {
        if (resolvedQuery.isPending) return es.bubble.loadingActivity;
        if (resolvedQuery.isError) return es.bubble.activitiesUnavailable;
        const resolved = resolvedByBubbleId.get(bubble.id);
        if (!resolved) return null;
        if (resolved.availability === "hidden") return es.bubble.hiddenTooltipStudent;
        if (resolved.availability === "missing") return es.bubble.unavailable;
        if (resolved.availability === "unknown") return null;
        if (resolved.activity && !isSafeActivityUrl(resolved.activity.url)) return es.bubble.cannotOpen;
        return null;
    };

    const getAvailabilityForBubble = (bubble: Bubble) => resolvedByBubbleId.get(bubble.id)?.availability;
    const getModname = (bubble: { activityId: number }) => activities.find((a) => a.activityId === bubble.activityId)?.modname;

    const handleSelectBubbleFromOverview = (bubble: Bubble) => {
        setIsActivitiesOverviewOpen(false);
        setFocusBubbleId(bubble.id);
    };

    const renderMapArea = () => {
        if (mapQuery.isPending) {
            return (
                <p className="flex items-center gap-2 text-sm text-ink-soft">
                    <Loader2 size={16} className="animate-spin" />
                    {es.app.loadingCourseMap}
                </p>
            );
        }

        if (mapQuery.isError || !renderable) {
            const status = mapQuery.error instanceof ApiError ? mapQuery.error.status : null;
            if (showPublished && status === 404) {
                // A link to a level that was never published (404 not_published).
                return (
                    <div className="space-y-3" role="status">
                        <p className="font-heading text-lg font-semibold text-ink">{es.student.levelUnavailable}</p>
                        <p className="text-sm text-ink-soft">{es.student.levelUnavailableHint}</p>
                        <Button variant="secondary" onClick={() => navigate({ name: "home" })}>
                            {es.app.backToHome}
                        </Button>
                    </div>
                );
            }
            if (status === 404) {
                return (
                    <div className="space-y-3">
                        <p className="text-sm text-ink-soft">{es.app.courseMapNotFound}</p>
                        <Button variant="secondary" onClick={() => navigate({ name: "home" })}>
                            {es.app.createNewMap}
                        </Button>
                    </div>
                );
            }
            return (
                <div className="space-y-3">
                    <p className="text-sm text-coral-dark">{es.app.courseMapLoadError}</p>
                    <Button variant="secondary" onClick={() => void mapQuery.refetch()}>
                        {es.app.retry}
                    </Button>
                </div>
            );
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
                    ariaLabel={es.canvas.ariaLabelWithProgress(
                        renderable.title,
                        bubbles.filter((bubble) => bubble.status === "complete").length,
                        bubbles.length
                    )}
                    bubbles={bubbles}
                    editable={isEditor}
                    fit={renderable.settings.fit}
                    mapMode={renderable.settings.mode}
                    initialView={renderable.settings.initialView}
                    intro={renderable.settings.intro}
                    pathSettings={renderable.settings.path}
                    ambient={renderable.settings.ambient}
                    onViewportChange={(view) => (latestViewportRef.current = view)}
                    skins={renderable.skins}
                    defaultSkinId={renderable.defaultSkinId}
                    skinRules={renderable.skinRules}
                    onBubbleMove={(bubbleId, x, y) => updateBubble.mutate({ bubbleId, input: { x, y } })}
                    onBubbleUpdate={(bubbleId, input) => updateBubble.mutate({ bubbleId, input })}
                    onBubbleDelete={(bubbleId) => deleteBubble.mutate(bubbleId)}
                    onActivityDrop={(activityId, x, y) => {
                        if (pendingActivityIds.includes(activityId)) return;
                        createBubble.mutate(
                            { activityId, x, y },
                            {
                                onError: (error) => {
                                    if (error instanceof ApiError && error.status === 409) {
                                        const title = error.detail.courseMapTitle;
                                        toast.show(
                                            typeof title === "string" ? es.sidebar.placedInAnotherLevel(title) : es.sidebar.alreadyPlaced,
                                            "error"
                                        );
                                    }
                                },
                            }
                        );
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
        );
    };

    const levelTitleById = useMemo(() => new Map(siblingLevels.map((level) => [level.id, level.title])), [siblingLevels]);

    const sidebarProps = {
        activities,
        pendingActivityIds,
        isLoading: activitiesQuery.isPending,
        error: activitiesQuery.isError,
        onRetry: () => void activitiesQuery.refetch(),
        currentCourseMapId: courseMapId ?? undefined,
        levelTitleById,
        sectionFilter: renderable?.moodleSectionId ?? null,
    };

    // "Publicado" needs something published; the level's own state says so.
    const neverPublished = publicationState.data?.status === "never_published";

    if (route.name === "home") {
        return (
            <div className="flex h-screen flex-col">
                <AppHeader onHome={() => navigate({ name: "home" })} />
                <MapsHome
                    onOpen={(id) => navigate({ name: "map", mapId: id })}
                    onOpenCourse={(moodleCourseId) => navigate({ name: "course", moodleCourseId, forceEntry: true })}
                />
            </div>
        );
    }

    if (route.name === "course") {
        return (
            <div className="flex h-screen flex-col">
                <AppHeader onHome={() => navigate({ name: "home" })} viewMode={viewMode} onViewModeChange={setViewMode} />
                <CourseLevels
                    moodleCourseId={route.moodleCourseId}
                    viewMode={viewMode}
                    onOpenLevel={(id) => navigate({ name: "map", mapId: id })}
                />
            </div>
        );
    }

    const breadcrumb =
        siblingLevels.length > 1 && currentLevelIndex !== -1 && renderable
            ? es.levels.breadcrumb(courseTitleFrom(siblingLevels), currentLevelIndex + 1, renderable.title)
            : renderable?.title;

    return (
        <div className="flex h-screen flex-col">
            <AppHeader
                onHome={() => navigate({ name: "home" })}
                mapTitle={breadcrumb}
                prevLevelTitle={prevLevel?.title}
                nextLevelTitle={nextLevel?.title}
                onPrevLevel={prevLevel ? () => navigate({ name: "map", mapId: prevLevel.id }) : undefined}
                onNextLevel={nextLevel ? () => navigate({ name: "map", mapId: nextLevel.id }) : undefined}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                publishedDisabled={neverPublished}
                isSaving={isEditor ? isSaving : undefined}
                onActivitiesOverview={() => setIsActivitiesOverviewOpen(true)}
                onAppearance={isEditor ? () => setIsAppearanceOpen(true) : undefined}
            />
            {isEditor && courseMapId && <PublicationBar courseMapId={courseMapId} />}
            {viewMode === "preview" && (
                <p role="status" className="border-b border-sun/40 bg-sun-tint px-4 py-2 text-sm text-sun-dark sm:px-6">
                    {es.viewMode.previewBanner}
                </p>
            )}
            {showPublished && renderable && (
                <p role="status" className="border-b border-leaf-dark/20 bg-leaf-tint px-4 py-2 text-sm text-leaf-dark sm:px-6">
                    {es.viewMode.publishedBanner}
                </p>
            )}
            {isEditor && neverPublished && (
                <p role="status" className="border-b border-sun/40 bg-sun-tint px-4 py-2 text-sm text-sun-dark sm:px-6">
                    {es.publication.neverPublishedBanner}
                </p>
            )}
            <div className="flex flex-1 overflow-hidden">
                {isEditor && (
                    <ActivitySidebar
                        {...sidebarProps}
                        className="hidden w-64 shrink-0 flex-col border-r border-ink/10 bg-surface p-4 md:flex"
                    />
                )}
                <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-6">
                    {moodleStatus === "unavailable" && (
                        <div
                            role="alert"
                            className="mb-3 flex items-center justify-between gap-3 rounded-md border border-sun/40 bg-sun-tint px-4 py-2 text-sm text-sun-dark"
                        >
                            <span>{es.moodleBanner.unavailable}</span>
                            <button
                                type="button"
                                onClick={() => void resolvedQuery.refetch()}
                                className="flex shrink-0 items-center gap-1 font-medium hover:underline"
                            >
                                <RefreshCw size={13} />
                                {es.moodleBanner.retry}
                            </button>
                        </div>
                    )}
                    {moodleStatus === "cached" && !cachedNoticeDismissed && (
                        <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-ink/10 bg-surface-muted px-4 py-2 text-xs text-ink-soft">
                            <span>{es.moodleBanner.cached}</span>
                            <button
                                type="button"
                                onClick={() => setCachedNoticeDismissed(true)}
                                className="font-medium hover:underline"
                            >
                                {es.app.dismiss}
                            </button>
                        </div>
                    )}
                    {saveErrorMessage && (
                        <div
                            role="alert"
                            className="mb-3 flex items-center justify-between rounded-md border border-coral-dark/30 bg-coral-tint px-4 py-2 text-sm text-coral-dark"
                        >
                            <span>{saveErrorMessage}</span>
                            <button type="button" onClick={dismissSaveError} className="ml-4 font-medium hover:underline">
                                {es.app.dismiss}
                            </button>
                        </div>
                    )}
                    <div className="relative min-h-0 flex-1">
                        {!isEditor && renderable && (
                            <StudentHud
                                bubbles={bubbles}
                                activities={activities}
                                onContinue={(bubble) => setFocusBubbleId(bubble.id)}
                                onNextLevel={nextLevel ? () => navigate({ name: "map", mapId: nextLevel.id }) : undefined}
                            />
                        )}
                        {renderMapArea()}
                    </div>
                </main>
            </div>

            {isEditor && (
                <button
                    type="button"
                    onClick={() => setIsMobileSidebarOpen(true)}
                    className="fixed bottom-6 right-6 z-30 flex min-h-[44px] items-center gap-2 rounded-pill bg-teal-dark px-5 py-3 text-sm font-semibold text-white shadow-soft md:hidden"
                >
                    <List size={16} />
                    {es.app.activities}
                    {unplacedCount > 0 && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-pill bg-white text-xs font-bold text-teal-dark">
                            {unplacedCount}
                        </span>
                    )}
                </button>
            )}

            {isEditor && isMobileSidebarOpen && (
                <div
                    role="presentation"
                    className="fixed inset-0 z-40 flex items-end bg-ink/40 md:hidden"
                    onClick={() => setIsMobileSidebarOpen(false)}
                >
                    <div
                        className="max-h-[75vh] w-full overflow-y-auto rounded-t-lg bg-surface shadow-soft"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mx-auto mt-2 h-1 w-10 rounded-pill bg-ink/15" />
                        <div className="flex justify-end px-4 pt-2">
                            <IconButton
                                aria-label={es.app.close}
                                variant="ghost"
                                onClick={() => setIsMobileSidebarOpen(false)}
                                className="h-9 w-9 min-h-0 min-w-0"
                            >
                                &#10005;
                            </IconButton>
                        </div>
                        <ActivitySidebar {...sidebarProps} className="flex flex-col p-4 pt-0" />
                    </div>
                </div>
            )}

            <ActivityModal activity={selectedActivity} onClose={() => setSelectedActivity(null)} />

            <ActivitiesOverviewModal
                open={isActivitiesOverviewOpen}
                bubbles={bubbles}
                activities={activities}
                mode={renderable?.settings.mode ?? "explorative"}
                view={isEditor ? "editor" : "student"}
                getAvailability={getAvailabilityForBubble}
                onClose={() => setIsActivitiesOverviewOpen(false)}
                onSelectBubble={handleSelectBubbleFromOverview}
            />

            {isEditor && isAppearanceOpen && draftQuery.data && (
                <Suspense fallback={null}>
                    <AppearanceStudio
                        courseMap={draftQuery.data}
                        skins={skinsQuery.data?.items ?? []}
                        getCurrentView={() => latestViewportRef.current}
                        onClose={() => setIsAppearanceOpen(false)}
                        onChangeBackground={() => setIsBackgroundPickerOpen(true)}
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
    );
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
}: {
    onHome: () => void;
    mapTitle?: string;
    prevLevelTitle?: string;
    nextLevelTitle?: string;
    onPrevLevel?: () => void;
    onNextLevel?: () => void;
    viewMode?: ViewMode;
    onViewModeChange?: (mode: ViewMode) => void;
    publishedDisabled?: boolean;
    isSaving?: boolean;
    onActivitiesOverview?: () => void;
    onAppearance?: () => void;
}) => {
    return (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 bg-surface px-4 py-3 shadow-soft sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
                <button type="button" onClick={onHome} className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-dark">
                    <Wordmark />
                </button>
                {mapTitle && (
                    <>
                        <span className="text-ink/20">/</span>
                        <span className="truncate text-sm font-semibold text-ink-soft">{mapTitle}</span>
                    </>
                )}
                {(onPrevLevel || onNextLevel) && (
                    <div className="flex items-center gap-0.5">
                        <IconButton
                            aria-label={prevLevelTitle ? `${es.levels.prevLevel}: ${prevLevelTitle}` : es.levels.prevLevel}
                            variant="ghost"
                            disabled={!onPrevLevel}
                            onClick={onPrevLevel}
                            className="h-8 w-8 min-h-0 min-w-0"
                        >
                            <ChevronLeft size={16} />
                        </IconButton>
                        <IconButton
                            aria-label={nextLevelTitle ? `${es.levels.nextLevel}: ${nextLevelTitle}` : es.levels.nextLevel}
                            variant="ghost"
                            disabled={!onNextLevel}
                            onClick={onNextLevel}
                            className="h-8 w-8 min-h-0 min-w-0"
                        >
                            <ChevronRight size={16} />
                        </IconButton>
                    </div>
                )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
                {isSaving !== undefined && (
                    <span className="text-xs font-medium text-ink-soft">
                        {isSaving ? es.app.saving : es.app.saved}
                    </span>
                )}
                {onAppearance && (
                    <Button variant="secondary" size="sm" onClick={onAppearance}>
                        {es.studio.open}
                    </Button>
                )}
                {onActivitiesOverview && (
                    <Button variant="secondary" size="sm" onClick={onActivitiesOverview}>
                        {es.app.activitiesOverview}
                    </Button>
                )}
                {viewMode && onViewModeChange && (
                    // TEMPORARY: a view toggle stands in for real editor/student
                    // roles until authentication exists.
                    <SegmentedControl
                        aria-label={es.viewMode.label}
                        value={viewMode}
                        onChange={onViewModeChange}
                        options={[
                            { value: "edit", label: es.viewMode.edit },
                            { value: "preview", label: es.viewMode.preview },
                            {
                                value: "published",
                                label: es.viewMode.published,
                                disabled: publishedDisabled,
                                hint: es.viewMode.publishedDisabled,
                            },
                        ]}
                    />
                )}
            </div>
        </header>
    );
};

export default App;
