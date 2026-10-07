import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { List, Loader2, RefreshCw } from "lucide-react";
import { ActivitySidebar } from "./features/course-map/components/ActivitySidebar.tsx";
import { ActivityModal } from "./features/course-map/components/ActivityModal.tsx";
import { ActivitiesOverviewModal } from "./features/course-map/components/ActivitiesOverviewModal.tsx";
import { MapsHome } from "./features/course-map/components/MapsHome.tsx";
import { StudentHud } from "./features/course-map/components/StudentHud.tsx";
import { rememberCourseMap } from "./features/course-map/data/recentMaps.ts";
import {
    ACTIVITY_OPEN_MODE,
    createActivityOpener,
    isSafeActivityUrl,
} from "./features/course-map/activityOpener.ts";
import {
    useActivities,
    useCourseMap,
    useCreateBubble,
    useDeleteBubble,
    usePendingActivityIds,
    useResolvedCourseMap,
    useUpdateBubble,
} from "./features/course-map/data/queries.ts";
import { ApiError, isUnreachable } from "./features/course-map/data/client.ts";
import type { Activity, Bubble, ResolvedBubble } from "./features/course-map/data/types.ts";
import { useRoute } from "./hooks/useRoute.ts";
import { Wordmark } from "./components/Logo.tsx";
import { Button, IconButton } from "./components/ui/Button.tsx";
import { SegmentedControl } from "./components/ui/SegmentedControl.tsx";
import { ToastProvider } from "./components/ui/Toast.tsx";
import { useToast } from "./components/ui/toastContext.ts";
import { es } from "./i18n/es.ts";

type Mode = "editor" | "student";

// Konva (and its React bindings) is only needed once a map is actually open,
// so it's kept out of the "Mis mapas" home bundle.
const MapCanvas = lazy(() =>
    import("./features/course-map/components/MapCanvas.tsx").then((m) => ({ default: m.MapCanvas }))
);

document.title = `${es.app.wordmark} — ${es.home.title}`;

function App() {
    return (
        <ToastProvider>
            <AppShell />
        </ToastProvider>
    );
}

function AppShell() {
    const toast = useToast();
    const [route, navigate] = useRoute();
    const [mode, setMode] = useState<Mode>("editor");
    const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [isActivitiesOverviewOpen, setIsActivitiesOverviewOpen] = useState(false);
    const [focusBubbleId, setFocusBubbleId] = useState<string | null>(null);
    const [cachedNoticeDismissed, setCachedNoticeDismissed] = useState(false);

    const courseMapId = route.name === "map" ? route.mapId : null;

    const courseMapQuery = useCourseMap(courseMapId);
    const activitiesQuery = useActivities(courseMapId, mode === "editor");
    const resolvedQuery = useResolvedCourseMap(courseMapId, mode === "editor");
    const createBubble = useCreateBubble(courseMapId ?? "");
    const updateBubble = useUpdateBubble(courseMapId ?? "");
    const deleteBubble = useDeleteBubble(courseMapId ?? "");
    const pendingActivityIds = usePendingActivityIds(courseMapId ?? "");

    useEffect(() => {
        if (courseMapQuery.data) rememberCourseMap(courseMapQuery.data);
    }, [courseMapQuery.data]);

    useEffect(() => {
        document.title = courseMapQuery.data
            ? `${courseMapQuery.data.title} — ${es.app.wordmark}`
            : `${es.app.wordmark} — ${es.home.title}`;
    }, [courseMapQuery.data]);

    const activities = useMemo(() => activitiesQuery.data ?? [], [activitiesQuery.data]);
    const bubbles = useMemo(() => courseMapQuery.data?.bubbles ?? [], [courseMapQuery.data]);
    const unplacedCount = activities.filter((activity) => !activity.placed).length;

    const resolvedByBubbleId = useMemo(
        () => new Map<string, ResolvedBubble>((resolvedQuery.data?.bubbles ?? []).map((rb) => [rb.bubbleId, rb])),
        [resolvedQuery.data]
    );
    const moodleStatus = resolvedQuery.data?.moodleStatus ?? null;

    const isSaving = updateBubble.isPending || createBubble.isPending || deleteBubble.isPending;

    const saveFailure = updateBubble.isError
        ? { message: es.app.saveReverted, error: updateBubble.error }
        : createBubble.isError
          ? { message: es.app.placeActivityError, error: createBubble.error }
          : deleteBubble.isError
            ? { message: es.app.deleteBubbleError, error: deleteBubble.error }
            : null;
    const saveErrorMessage = saveFailure
        ? isUnreachable(saveFailure.error)
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

    // Student view only (MapCanvas forces this to null in editor mode): joins
    // GET /course-maps/{id}/resolved against the map's own bubbles to decide
    // whether a bubble can be opened, replacing the old "is it in the live
    // activities list" heuristic with the precise available/hidden/missing/
    // unknown states from the backend.
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

    const handleSelectBubbleFromOverview = (bubble: Bubble) => {
        setIsActivitiesOverviewOpen(false);
        setFocusBubbleId(bubble.id);
    };

    const renderMapArea = () => {
        if (courseMapQuery.isPending) {
            return (
                <p className="flex items-center gap-2 text-sm text-ink-soft">
                    <Loader2 size={16} className="animate-spin" />
                    {es.app.loadingCourseMap}
                </p>
            );
        }

        if (courseMapQuery.isError) {
            if (courseMapQuery.error instanceof ApiError && courseMapQuery.error.status === 404) {
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
                    <Button variant="secondary" onClick={() => void courseMapQuery.refetch()}>
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
                backgroundUrl={courseMapQuery.data.imageUrl}
                bubbles={bubbles}
                editable={mode === "editor"}
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
                                    toast.show(es.sidebar.alreadyPlaced, "error");
                                }
                            },
                        }
                    );
                }}
                onBubbleClick={handleBubbleClick}
                getUnavailableReason={getUnavailableReason}
                getAvailability={getAvailabilityForBubble}
                getModnameForBubble={(bubble) => activities.find((a) => a.activityId === bubble.activityId)?.modname}
                getResolvedActivity={(bubble) => resolvedByBubbleId.get(bubble.id)?.activity ?? null}
                focusBubbleId={focusBubbleId}
                onFocusHandled={() => setFocusBubbleId(null)}
            />
            </Suspense>
        );
    };

    const sidebarProps = {
        activities,
        pendingActivityIds,
        isLoading: activitiesQuery.isPending,
        error: activitiesQuery.isError,
        onRetry: () => void activitiesQuery.refetch(),
    };

    if (route.name === "home") {
        return (
            <div className="flex h-screen flex-col">
                <AppHeader onHome={() => navigate({ name: "home" })} />
                <MapsHome onOpen={(id) => navigate({ name: "map", mapId: id })} />
            </div>
        );
    }

    if (route.name === "course") {
        return (
            <div className="flex h-screen flex-col">
                <AppHeader onHome={() => navigate({ name: "home" })} />
                <MapsHome
                    onOpen={(id) => navigate({ name: "map", mapId: id })}
                    initialCreateCourseId={route.moodleCourseId}
                />
            </div>
        );
    }

    return (
            <div className="flex h-screen flex-col">
                <AppHeader
                    onHome={() => navigate({ name: "home" })}
                    mapTitle={courseMapQuery.data?.title}
                    mode={mode}
                    onModeChange={setMode}
                    isSaving={isSaving}
                    onActivitiesOverview={() => setIsActivitiesOverviewOpen(true)}
                />
                <div className="flex flex-1 overflow-hidden">
                    {mode === "editor" && (
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
                            {mode === "student" && courseMapQuery.data && (
                                <StudentHud
                                    bubbles={bubbles}
                                    activities={activities}
                                    onContinue={(bubble) => setFocusBubbleId(bubble.id)}
                                />
                            )}
                            {renderMapArea()}
                        </div>
                    </main>
                </div>

                {mode === "editor" && (
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

                {mode === "editor" && isMobileSidebarOpen && (
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
                    onClose={() => setIsActivitiesOverviewOpen(false)}
                    onSelectBubble={handleSelectBubbleFromOverview}
                />
            </div>
    );
}

const AppHeader = ({
    onHome,
    mapTitle,
    mode,
    onModeChange,
    isSaving,
    onActivitiesOverview,
}: {
    onHome: () => void;
    mapTitle?: string;
    mode?: Mode;
    onModeChange?: (mode: Mode) => void;
    isSaving?: boolean;
    onActivitiesOverview?: () => void;
}) => (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 bg-surface px-6 py-3 shadow-soft">
        <div className="flex items-center gap-3">
            <button type="button" onClick={onHome} className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-dark">
                <Wordmark />
            </button>
            {mapTitle && (
                <>
                    <span className="text-ink/20">/</span>
                    <span className="truncate text-sm font-semibold text-ink-soft">{mapTitle}</span>
                </>
            )}
        </div>
        <div className="flex items-center gap-3">
            {isSaving !== undefined && (
                <span className="text-xs font-medium text-ink-soft">
                    {isSaving ? es.app.saving : es.app.saved}
                </span>
            )}
            {onActivitiesOverview && (
                <Button variant="secondary" size="sm" onClick={onActivitiesOverview}>
                    {es.app.activitiesOverview}
                </Button>
            )}
            {mode && onModeChange && (
                // TEMPORARY: a mode toggle stands in for real editor/student
                // roles until authentication exists.
                <SegmentedControl
                    aria-label={`${es.app.modeEditor} / ${es.app.modeStudent}`}
                    value={mode}
                    onChange={onModeChange}
                    options={[
                        { value: "editor", label: es.app.modeEditor },
                        { value: "student", label: es.app.modeStudent },
                    ]}
                />
            )}
        </div>
    </header>
);

export default App;
