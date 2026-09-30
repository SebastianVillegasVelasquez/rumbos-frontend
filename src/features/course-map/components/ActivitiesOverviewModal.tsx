import type { Activity, BubbleData, BubbleStatus } from "../types/course-props.types.ts";

interface ActivitiesOverviewModalProps {
    open: boolean;
    bubbles: BubbleData[];
    activities: Activity[];
    onClose: () => void;
    onSelectBubble: (bubble: BubbleData) => void;
}

interface GroupDef {
    title: string;
    description: string;
    statuses: BubbleStatus[];
}

// Display-only for this sprint: reads the same bubbles/activities already in
// state, doesn't touch points/scoring. See sprint brief - that's a separate,
// backend-dependent feature.
const GROUPS: GroupDef[] = [
    { title: "Completed", description: "Finished activities", statuses: ["complete"] },
    { title: "In progress", description: "Started but not finished", statuses: ["in_progress"] },
    { title: "Locked / Pending", description: "Not yet available or not started", statuses: ["locked", "no_complete"] },
];

export const ActivitiesOverviewModal = ({
    open,
    bubbles,
    activities,
    onClose,
    onSelectBubble,
}: ActivitiesOverviewModalProps) => {
    if (!open) return null;

    const activityById = new Map(activities.map((activity) => [activity.id, activity]));

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Activities overview"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={onClose}
        >
            <div
                className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                    <h2 className="font-semibold text-gray-800">Activities overview</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                        &#10005;
                    </button>
                </div>
                <div className="flex-1 space-y-5 overflow-y-auto p-4">
                    {GROUPS.map((group) => {
                        const groupBubbles = bubbles.filter((bubble) => group.statuses.includes(bubble.status));
                        return (
                            <section key={group.title}>
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    {group.title}{" "}
                                    <span className="font-normal normal-case text-gray-400">({groupBubbles.length})</span>
                                </h3>
                                <p className="mb-2 text-xs text-gray-400">{group.description}</p>
                                {groupBubbles.length === 0 ? (
                                    <p className="text-sm text-gray-300">Nothing here yet.</p>
                                ) : (
                                    <ul className="space-y-1.5">
                                        {groupBubbles.map((bubble) => {
                                            const activity = activityById.get(bubble.activityId);
                                            return (
                                                <li key={bubble.bubbleId}>
                                                    <button
                                                        type="button"
                                                        onClick={() => onSelectBubble(bubble)}
                                                        className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-left text-sm shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50"
                                                    >
                                                        <span className="truncate text-gray-700">
                                                            {activity?.name ?? `Activity #${bubble.activityId}`}
                                                        </span>
                                                        {activity && (
                                                            <span className="ml-3 shrink-0 text-[10px] font-medium uppercase text-gray-400">
                                                                {activity.type}
                                                            </span>
                                                        )}
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </section>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
