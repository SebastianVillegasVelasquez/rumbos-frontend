import { useMemo, useState } from "react";
import { MapCanvas } from "./features/course-map/components/MapCanvas.tsx";
import { ActivitySidebar } from "./features/course-map/components/ActivitySidebar.tsx";
import { ActivityModal } from "./features/course-map/components/ActivityModal.tsx";
import { ActivitiesOverviewModal } from "./features/course-map/components/ActivitiesOverviewModal.tsx";
import { CreateMapPanel } from "./features/course-map/components/CreateMapPanel.tsx";
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
    useUpdateBubble,
} from "./features/course-map/data/queries.ts";
import { ApiError, isUnreachable } from "./features/course-map/data/client.ts";
import type { Activity, Bubble } from "./features/course-map/data/types.ts";

type Mode = "editor" | "student";

const readMapIdFromUrl = () => new URLSearchParams(window.location.search).get("map");

const writeMapIdToUrl = (courseMapId: string | null) => {
    const url = new URL(window.location.href);
    if (courseMapId) url.searchParams.set("map", courseMapId);
    else url.searchParams.delete("map");
    window.history.replaceState(null, "", url);
};

function App() {
    const [mode, setMode] = useState<Mode>("editor");
    const [courseMapId, setCourseMapId] = useState<string | null>(readMapIdFromUrl);
    const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [isActivitiesOverviewOpen, setIsActivitiesOverviewOpen] = useState(false);
    const [focusBubbleId, setFocusBubbleId] = useState<string | null>(null);

    const courseMapQuery = useCourseMap(courseMapId);
    const activitiesQuery = useActivities(courseMapId, mode === "editor");
    const createBubble = useCreateBubble(courseMapId ?? "");
    const updateBubble = useUpdateBubble(courseMapId ?? "");
    const deleteBubble = useDeleteBubble(courseMapId ?? "");
    const pendingActivityIds = usePendingActivityIds(courseMapId ?? "");

    const activities = useMemo(() => activitiesQuery.data ?? [], [activitiesQuery.data]);
    const bubbles = useMemo(() => courseMapQuery.data?.bubbles ?? [], [courseMapQuery.data]);
    const unplacedCount = activities.filter((activity) => !activity.placed).length;

    const saveFailure = updateBubble.isError
        ? { message: "Could not save the change. It was reverted.", error: updateBubble.error }
        : createBubble.isError
          ? { message: "Could not place the activity on the map.", error: createBubble.error }
          : deleteBubble.isError
            ? { message: "Could not delete the bubble.", error: deleteBubble.error }
            : null;
    const saveErrorMessage = saveFailure
        ? isUnreachable(saveFailure.error)
            ? `${saveFailure.message} Cannot reach the server.`
            : saveFailure.message
        : null;

    const dismissSaveError = () => {
        updateBubble.reset();
        createBubble.reset();
        deleteBubble.reset();
    };

    const selectCourseMap = (id: string) => {
        writeMapIdToUrl(id);
        setCourseMapId(id);
    };

    const clearCourseMap = () => {
        writeMapIdToUrl(null);
        setCourseMapId(null);
    };

    const openActivity = useMemo(
        () => createActivityOpener(ACTIVITY_OPEN_MODE, setSelectedActivity),
        []
    );

    const handleBubbleClick = (bubble: Bubble) => {
        const activity = activities.find((a) => a.activityId === bubble.activityId);
        if (activity) openActivity(activity);
    };

    const getUnavailableReason = (bubble: Bubble): string | null => {
        if (activitiesQuery.isPending) return "Loading activity...";
        if (activitiesQuery.isError) return "Activities are unavailable right now";
        const activity = activities.find((a) => a.activityId === bubble.activityId);
        if (!activity) return "This activity is no longer available";
        if (!isSafeActivityUrl(activity.url)) return "This activity cannot be opened";
        return null;
    };

    const handleSelectBubbleFromOverview = (bubble: Bubble) => {
        setIsActivitiesOverviewOpen(false);
        setFocusBubbleId(bubble.id);
    };

    const renderMapArea = () => {
        if (!courseMapId) return <CreateMapPanel onCreated={selectCourseMap} />;

        if (courseMapQuery.isPending) return <p className="text-sm text-gray-400">Loading course map...</p>;

        if (courseMapQuery.isError) {
            if (courseMapQuery.error instanceof ApiError && courseMapQuery.error.status === 404) {
                return (
                    <div className="space-y-3">
                        <p className="text-sm text-gray-600">This course map does not exist.</p>
                        <button
                            type="button"
                            onClick={clearCourseMap}
                            className="text-sm font-medium text-blue-600 hover:underline"
                        >
                            Create a new map
                        </button>
                    </div>
                );
            }
            return (
                <div className="space-y-3">
                    <p className="text-sm text-red-600">Could not load the course map.</p>
                    <button
                        type="button"
                        onClick={() => void courseMapQuery.refetch()}
                        className="text-sm font-medium text-blue-600 hover:underline"
                    >
                        Retry
                    </button>
                </div>
            );
        }

        return (
            <MapCanvas
                backgroundUrl={courseMapQuery.data.imageUrl}
                bubbles={bubbles}
                editable={mode === "editor"}
                onBubbleMove={(bubbleId, x, y) => updateBubble.mutate({ bubbleId, input: { x, y } })}
                onBubbleUpdate={(bubbleId, input) => updateBubble.mutate({ bubbleId, input })}
                onBubbleDelete={(bubbleId) => deleteBubble.mutate(bubbleId)}
                onActivityDrop={(activityId, x, y) => {
                    if (!pendingActivityIds.includes(activityId)) createBubble.mutate({ activityId, x, y });
                }}
                onBubbleClick={handleBubbleClick}
                getUnavailableReason={getUnavailableReason}
                focusBubbleId={focusBubbleId}
                onFocusHandled={() => setFocusBubbleId(null)}
            />
        );
    };

    const sidebarProps = {
        activities,
        pendingActivityIds,
        isLoading: activitiesQuery.isPending,
        error: activitiesQuery.isError,
        onRetry: () => void activitiesQuery.refetch(),
    };

    return (
        <div className="flex h-screen flex-col bg-gray-100">
            <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3 shadow-sm">
                <div className="flex items-center gap-3">
                    <span className="text-xl font-bold text-blue-600">Rumbos</span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-gray-500">
                        {mode === "editor" ? "Editor view" : "Student view"}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setIsActivitiesOverviewOpen(true)}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
                    >
                        Activities overview
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode((m) => (m === "editor" ? "student" : "editor"))}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                    >
                        Switch to {mode === "editor" ? "Student" : "Editor"} view
                    </button>
                </div>
            </header>
            <div className="flex flex-1 overflow-hidden">
                {mode === "editor" && courseMapId && (
                    <ActivitySidebar
                        {...sidebarProps}
                        className="hidden w-64 shrink-0 flex-col border-r border-gray-200 bg-white p-4 md:flex"
                    />
                )}
                <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-6">
                    {saveErrorMessage && (
                        <div
                            role="alert"
                            className="mb-3 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700"
                        >
                            <span>{saveErrorMessage}</span>
                            <button type="button" onClick={dismissSaveError} className="ml-4 text-red-500 hover:underline">
                                Dismiss
                            </button>
                        </div>
                    )}
                    <div className="min-h-0 flex-1">{renderMapArea()}</div>
                </main>
            </div>

            {mode === "editor" && courseMapId && (
                <button
                    type="button"
                    onClick={() => setIsMobileSidebarOpen(true)}
                    className="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-medium text-white shadow-lg md:hidden"
                >
                    Activities
                    {unplacedCount > 0 && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-blue-600">
                            {unplacedCount}
                        </span>
                    )}
                </button>
            )}

            {mode === "editor" && courseMapId && isMobileSidebarOpen && (
                <div
                    role="presentation"
                    className="fixed inset-0 z-40 flex items-end bg-black/40 md:hidden"
                    onClick={() => setIsMobileSidebarOpen(false)}
                >
                    <div
                        className="max-h-[75vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-gray-300" />
                        <div className="flex justify-end px-4 pt-2">
                            <button
                                type="button"
                                onClick={() => setIsMobileSidebarOpen(false)}
                                aria-label="Close"
                                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            >
                                &#10005;
                            </button>
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

export default App;
