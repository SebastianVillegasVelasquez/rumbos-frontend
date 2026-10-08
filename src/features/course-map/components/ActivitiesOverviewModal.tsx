import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { Activity, Availability, Bubble, MapMode } from "../data/types.ts";
import { deriveVisualState, nextIncompleteSequence, type VisualState } from "../visualState.ts";
import { es } from "../../../i18n/es.ts";
import { Badge } from "../../../components/ui/Card.tsx";

interface ActivitiesOverviewModalProps {
    open: boolean;
    bubbles: Bubble[];
    activities: Activity[];
    mode: MapMode;
    view: "editor" | "student";
    getAvailability: (bubble: Bubble) => Availability | undefined;
    onClose: () => void;
    onSelectBubble: (bubble: Bubble) => void;
}

type GroupKey = "next" | "complete" | "in_progress" | "available" | "locked" | "teaser" | "unavailable";

const GROUP_FOR: Record<VisualState, GroupKey> = {
    next: "next",
    complete: "complete",
    inProgress: "in_progress",
    available: "available",
    locked: "locked",
    teaser: "teaser",
    missing: "unavailable",
    unknown: "unavailable",
};

const GROUP_ORDER: { key: GroupKey; tone: "leaf" | "teal" | "sun" | "slate" | "coral" }[] = [
    { key: "next", tone: "sun" },
    { key: "in_progress", tone: "teal" },
    { key: "available", tone: "sun" },
    { key: "complete", tone: "leaf" },
    { key: "locked", tone: "slate" },
    { key: "teaser", tone: "slate" },
    { key: "unavailable", tone: "coral" },
];

// Display-only for this sprint: reads the same bubbles/activities already in
// state, doesn't touch points/scoring - that's a separate, backend-dependent
// feature. Doubles as the accessible, keyboard-navigable equivalent of the
// Konva canvas (see role="img" on MapCanvas's container) - grouped by the
// same deriveVisualState the canvas itself renders, so "next"/"teaser"/etc
// show up here exactly as they do on the map.
export const ActivitiesOverviewModal = ({
    open,
    bubbles,
    activities,
    mode,
    view,
    getAvailability,
    onClose,
    onSelectBubble,
}: ActivitiesOverviewModalProps) => {
    const activityById = new Map(activities.map((activity) => [activity.activityId, activity]));
    const nextSequence = nextIncompleteSequence(bubbles);

    const byGroup = new Map<GroupKey, Bubble[]>();
    for (const bubble of bubbles) {
        const state = deriveVisualState({
            status: bubble.status,
            sequence: bubble.sequence,
            mode,
            availability: getAvailability(bubble),
            view,
            nextIncompleteSequence: nextSequence,
        });
        const key = GROUP_FOR[state];
        byGroup.set(key, [...(byGroup.get(key) ?? []), bubble]);
    }

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
                        {GROUP_ORDER.filter(({ key }) => (byGroup.get(key)?.length ?? 0) > 0).map(({ key, tone }) => {
                            const groupMeta = es.overview.groups[key];
                            const groupBubbles = byGroup.get(key) ?? [];
                            return (
                                <section key={key}>
                                    <div className="mb-1 flex items-center gap-2">
                                        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                                            {groupMeta.title}
                                        </h3>
                                        <Badge tone={tone}>{groupBubbles.length}</Badge>
                                    </div>
                                    <p className="mb-2 text-xs text-ink-soft/70">{groupMeta.description}</p>
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
                                </section>
                            );
                        })}
                        {bubbles.length === 0 && <p className="text-sm text-slate-dark">{es.overview.empty}</p>}
                    </div>
                </RadixDialog.Content>
            </RadixDialog.Portal>
        </RadixDialog.Root>
    );
};
