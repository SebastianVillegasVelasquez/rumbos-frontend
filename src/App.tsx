import { useEffect, useMemo, useState } from "react";
import { MapCanvas } from "./features/course-map/components/MapCanvas.tsx";
import { ActivitySidebar } from "./features/course-map/components/ActivitySidebar.tsx";
import { ActivityModal } from "./features/course-map/components/ActivityModal.tsx";
import { getActivities, getCourseMap } from "./features/course-map/api.ts";
import type { Activity, BubbleData, CourseMap } from "./features/course-map/types/course-props.types.ts";

type Mode = "editor" | "student";

function App() {
    const [mode, setMode] = useState<Mode>("editor");
    const [courseMap, setCourseMap] = useState<CourseMap | null>(null);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

    useEffect(() => {
        getCourseMap(1).then(setCourseMap);
        getActivities().then(setActivities);
    }, []);

    const bubbles = useMemo(() => courseMap?.bubbles ?? [], [courseMap]);

    const unplacedActivities = useMemo(() => {
        const placedActivityIds = new Set(bubbles.map((bubble) => bubble.activityId));
        return activities.filter((activity) => !placedActivityIds.has(activity.id));
    }, [activities, bubbles]);

    const handleBubblesChange = (nextBubbles: BubbleData[]) => {
        setCourseMap((prev) => (prev ? { ...prev, bubbles: nextBubbles } : prev));
    };

    const handleBubbleClick = (bubble: BubbleData) => {
        const activity = activities.find((a) => a.id === bubble.activityId) ?? null;
        setSelectedActivity(activity);
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
                <button
                    type="button"
                    onClick={() => setMode((m) => (m === "editor" ? "student" : "editor"))}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                    Switch to {mode === "editor" ? "Student" : "Editor"} view
                </button>
            </header>
            <div className="flex flex-1 overflow-hidden">
                {mode === "editor" && (
                    <ActivitySidebar
                        activities={unplacedActivities}
                        className="hidden w-64 shrink-0 flex-col border-r border-gray-200 bg-white p-4 md:flex"
                    />
                )}
                <main className="min-h-0 flex-1 overflow-hidden p-6">
                    {courseMap ? (
                        <MapCanvas
                            backgroundUrl={courseMap.imageUrl}
                            bubbles={bubbles}
                            editable={mode === "editor"}
                            onBubblesChange={handleBubblesChange}
                            onBubbleClick={handleBubbleClick}
                        />
                    ) : (
                        <p className="text-sm text-gray-400">Loading course map...</p>
                    )}
                </main>
            </div>

            {mode === "editor" && (
                <button
                    type="button"
                    onClick={() => setIsMobileSidebarOpen(true)}
                    className="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-medium text-white shadow-lg md:hidden"
                >
                    Activities
                    {unplacedActivities.length > 0 && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-blue-600">
                            {unplacedActivities.length}
                        </span>
                    )}
                </button>
            )}

            {mode === "editor" && isMobileSidebarOpen && (
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
                        <ActivitySidebar activities={unplacedActivities} className="flex flex-col p-4 pt-0" />
                    </div>
                </div>
            )}

            <ActivityModal activity={selectedActivity} onClose={() => setSelectedActivity(null)} />
        </div>
    );
}

export default App;
