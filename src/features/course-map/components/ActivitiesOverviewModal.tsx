import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { Activity, Bubble, BubbleStatus } from "../data/types.ts";
import { es } from "../../../i18n/es.ts";
import { Badge } from "../../../components/ui/Card.tsx";

interface ActivitiesOverviewModalProps {
    open: boolean;
    bubbles: Bubble[];
    activities: Activity[];
    onClose: () => void;
    onSelectBubble: (bubble: Bubble) => void;
}

interface GroupDef {
    key: "complete" | "in_progress" | "pending";
    statuses: BubbleStatus[];
    tone: "leaf" | "teal" | "slate";
}

// Display-only for this sprint: reads the same bubbles/activities already in
// state, doesn't touch points/scoring - that's a separate, backend-dependent
// feature. Doubles as the accessible, keyboard-navigable equivalent of the
// Konva canvas (see role="img" on MapCanvas's container).
const GROUPS: GroupDef[] = [
    { key: "complete", statuses: ["complete"], tone: "leaf" },
    { key: "in_progress", statuses: ["in_progress"], tone: "teal" },
    { key: "pending", statuses: ["locked", "no_complete"], tone: "slate" },
];

export const ActivitiesOverviewModal = ({
    open,
    bubbles,
    activities,
    onClose,
    onSelectBubble,
}: ActivitiesOverviewModalProps) => {
    const activityById = new Map(activities.map((activity) => [activity.activityId, activity]));

    return (
        <RadixDialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
            <RadixDialog.Portal>
                <RadixDialog.Overlay className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm" />
                <RadixDialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[80vh] w-[min(95vw,40rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg bg-surface shadow-soft focus:outline-none">
                    <div className="flex items-center justify-between border-b border-ink/10 px-4 py-3">
                        <RadixDialog.Title className="font-heading font-semibold text-ink">
                            {es.overview.title}
                        </RadixDialog.Title>
                        <RadixDialog.Close
                            aria-label={es.overview.close}
                            className="rounded-pill p-1.5 text-ink-soft hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-dark"
                        >
                            <X size={18} />
                        </RadixDialog.Close>
                    </div>
                    <div className="flex-1 space-y-5 overflow-y-auto p-4">
                        {GROUPS.map((group) => {
                            const groupMeta = es.overview.groups[group.key];
                            const groupBubbles = bubbles.filter((bubble) => group.statuses.includes(bubble.status));
                            return (
                                <section key={group.key}>
                                    <div className="mb-1 flex items-center gap-2">
                                        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                                            {groupMeta.title}
                                        </h3>
                                        <Badge tone={group.tone}>{groupBubbles.length}</Badge>
                                    </div>
                                    <p className="mb-2 text-xs text-ink-soft/70">{groupMeta.description}</p>
                                    {groupBubbles.length === 0 ? (
                                        <p className="text-sm text-slate-dark">{es.overview.empty}</p>
                                    ) : (
                                        <ul className="space-y-1.5">
                                            {groupBubbles.map((bubble) => {
                                                const activity = activityById.get(bubble.activityId);
                                                return (
                                                    <li key={bubble.id}>
                                                        <button
                                                            type="button"
                                                            onClick={() => onSelectBubble(bubble)}
                                                            className="flex min-h-[44px] w-full items-center justify-between rounded-md border border-ink/10 bg-surface-muted px-3 py-2 text-left text-sm shadow-soft transition-colors hover:bg-teal-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-dark"
                                                        >
                                                            <span className="truncate text-ink">
                                                                {activity?.name ?? `#${bubble.activityId}`}
                                                            </span>
                                                            {activity && (
                                                                <span className="ml-3 shrink-0 text-[11px] font-medium uppercase text-ink-soft">
                                                                    {es.activityTypes[activity.modname as keyof typeof es.activityTypes] ??
                                                                        es.activityTypes.default}
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
                </RadixDialog.Content>
            </RadixDialog.Portal>
        </RadixDialog.Root>
    );
};
