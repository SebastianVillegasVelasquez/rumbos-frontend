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
                {mode === "editor" && <ActivitySidebar activities={unplacedActivities} />}
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
            <ActivityModal activity={selectedActivity} onClose={() => setSelectedActivity(null)} />
        </div>
    );
}

export default App;
