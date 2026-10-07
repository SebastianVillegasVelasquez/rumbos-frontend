import { ArrowRight } from "lucide-react";
import type { Activity, Bubble } from "../data/types.ts";
import { es } from "../../../i18n/es.ts";
import { Card } from "../../../components/ui/Card.tsx";
import { ProgressBar } from "../../../components/ui/Skeleton.tsx";
import { Button } from "../../../components/ui/Button.tsx";

interface StudentHudProps {
    bubbles: Bubble[];
    activities: Activity[];
    onContinue: (bubble: Bubble) => void;
}

// Derived entirely from the existing `status` field (see the sprint brief):
// real per-student completion will come from Moodle completion data later.
export const StudentHud = ({ bubbles, activities, onContinue }: StudentHudProps) => {
    if (bubbles.length === 0) return null;

    const completed = bubbles.filter((bubble) => bubble.status === "complete").length;
    const next = bubbles.find((bubble) => bubble.status === "no_complete" || bubble.status === "in_progress");
    const nextActivity = next ? activities.find((activity) => activity.activityId === next.activityId) : undefined;

    return (
        <Card className="pointer-events-auto absolute left-1/2 top-3 z-10 w-[min(92vw,22rem)] -translate-x-1/2 space-y-2 p-3.5">
            <p className="text-sm font-semibold text-ink">{es.hud.progress(completed, bubbles.length)}</p>
            <ProgressBar value={completed} max={bubbles.length} />
            {next && nextActivity && (
                <Button size="sm" variant="secondary" className="w-full" onClick={() => onContinue(next)}>
                    {es.hud.continue(nextActivity.name)}
                    <ArrowRight size={14} />
                </Button>
            )}
        </Card>
    );
};
