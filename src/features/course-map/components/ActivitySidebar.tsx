import type { Activity, ActivityType } from "../types/course-props.types.ts";

interface ActivitySidebarProps {
    activities: Activity[];
}

const TYPE_ICONS: Record<ActivityType, string> = {
    quiz: "\u{1F4DD}",
    url: "\u{1F517}",
    assign: "\u{1F4C4}",
    resource: "\u{1F4DA}",
};

const handleDragStart = (e: React.DragEvent<HTMLLIElement>, activity: Activity) => {
    e.dataTransfer.setData("application/json", JSON.stringify(activity));
    e.dataTransfer.effectAllowed = "copy";
};

export const ActivitySidebar = ({ activities }: ActivitySidebarProps) => {
    return (
        <aside className="flex w-64 shrink-0 flex-col border-r border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Available Activities
            </h2>
            <p className="mb-3 text-xs text-gray-400">Drag an activity onto the map to place it.</p>
            {activities.length === 0 ? (
                <p className="text-sm text-gray-400">All activities have been placed.</p>
            ) : (
                <ul className="space-y-2">
                    {activities.map((activity) => (
                        <li
                            key={activity.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, activity)}
                            className="flex cursor-grab items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50 active:cursor-grabbing"
                        >
                            <span className="text-lg leading-none">{TYPE_ICONS[activity.type]}</span>
                            <span className="flex-1 truncate text-gray-700">{activity.name}</span>
                            <span className="text-[10px] font-medium uppercase text-gray-400">{activity.type}</span>
                        </li>
                    ))}
                </ul>
            )}
        </aside>
    );
};
