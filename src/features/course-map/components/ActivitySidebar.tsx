import type { Activity } from "../data/types.ts";

interface ActivitySidebarProps {
    activities: Activity[];
    isLoading: boolean;
    error: boolean;
    onRetry: () => void;
    className?: string;
}

// Moodle module names are open-ended; anything not listed gets the fallback icon.
const MODNAME_ICONS: Record<string, string> = {
    quiz: "\u{1F4DD}",
    url: "\u{1F517}",
    assign: "\u{1F4C4}",
    resource: "\u{1F4DA}",
    scorm: "\u{1F393}",
    customcert: "\u{1F3C5}",
    forum: "\u{1F4AC}",
};
const FALLBACK_ICON = "\u{1F4CE}";

const handleDragStart = (e: React.DragEvent<HTMLLIElement>, activity: Activity) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ activityId: activity.activityId }));
    e.dataTransfer.effectAllowed = "copy";
};

const DEFAULT_CLASS_NAME = "flex w-64 shrink-0 flex-col border-r border-gray-200 bg-white p-4";

export const ActivitySidebar = ({ activities, isLoading, error, onRetry, className }: ActivitySidebarProps) => {
    const unplaced = activities.filter((activity) => !activity.placed);

    const renderList = () => {
        if (error) {
            return (
                <div className="space-y-2">
                    <p className="text-sm text-red-600">Could not load activities from Moodle.</p>
                    <button
                        type="button"
                        onClick={onRetry}
                        className="text-sm font-medium text-blue-600 hover:underline"
                    >
                        Retry
                    </button>
                </div>
            );
        }
        if (isLoading) return <p className="text-sm text-gray-400">Loading activities...</p>;
        if (unplaced.length === 0) return <p className="text-sm text-gray-400">All activities have been placed.</p>;

        return (
            <ul className="space-y-2">
                {unplaced.map((activity) => (
                    <li
                        key={activity.activityId}
                        draggable
                        onDragStart={(e) => handleDragStart(e, activity)}
                        className="flex cursor-grab flex-col gap-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50 active:cursor-grabbing"
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-lg leading-none">{MODNAME_ICONS[activity.modname] ?? FALLBACK_ICON}</span>
                            <span className="flex-1 truncate text-gray-700">{activity.name}</span>
                            <span className="text-[10px] font-medium uppercase text-gray-400">{activity.modname}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-gray-400">
                            <span className="truncate">{activity.sectionName}</span>
                            {activity.hidden && (
                                <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 font-medium uppercase text-amber-700">
                                    hidden
                                </span>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
        );
    };

    return (
        <aside className={className ?? DEFAULT_CLASS_NAME}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Available Activities
            </h2>
            <p className="mb-3 text-xs text-gray-400">Drag an activity onto the map to place it.</p>
            {renderList()}
        </aside>
    );
};
