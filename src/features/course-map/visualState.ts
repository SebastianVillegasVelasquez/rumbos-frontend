import type { Availability, Bubble, BubbleStatus, MapMode } from "./data/types.ts";

// What a bubble actually looks like, derived from its backend status, the
// map's mode, its place in the guided sequence, the resolved Moodle
// availability, and who's looking. This is the single source of truth for
// bubble appearance - BubbleVisual only renders one of these, it never
// re-derives it.
export type VisualState =
    | "locked"
    | "available"
    | "next"
    | "inProgress"
    | "complete"
    | "teaser"
    | "missing"
    | "unknown";

export type MapView = "editor" | "student";

export interface DeriveVisualStateInput {
    status: BubbleStatus;
    sequence: number;
    mode: MapMode;
    availability: Availability | undefined;
    view: MapView;
    // The lowest `sequence` among this map's bubbles that are still
    // incomplete (status !== "complete"), or null if every bubble is
    // complete / there are no bubbles. Computed once per map by the caller
    // (see nextIncompleteSequence below) and passed in, so this function
    // stays pure and doesn't need the whole bubble list.
    nextIncompleteSequence: number | null;
}

// TODO(moodle-restrictions): "locked" for later guided-mode bubbles is a
// placeholder until real Moodle activity restrictions drive availability;
// today it's purely sequence-derived.
export function deriveVisualState(input: DeriveVisualStateInput): VisualState {
    const { status, sequence, mode, availability, view, nextIncompleteSequence } = input;

    if (availability === "missing") return "missing";
    if (availability === "hidden" && view === "student") return "teaser";
    if (availability === "unknown") return "unknown";

    if (status === "complete") return "complete";
    if (status === "in_progress") return "inProgress";
    if (status === "locked") return "locked";

    // status === "no_complete"
    if (mode === "explorative") return "available";
    return nextIncompleteSequence !== null && sequence === nextIncompleteSequence ? "next" : "locked";
}

// Helper for the caller: the lowest `sequence` among bubbles that aren't yet
// complete, for guided mode's single "next" bubble.
export function nextIncompleteSequence(bubbles: Pick<Bubble, "status" | "sequence">[]): number | null {
    const incomplete = bubbles.filter((bubble) => bubble.status !== "complete");
    if (incomplete.length === 0) return null;
    return Math.min(...incomplete.map((bubble) => bubble.sequence));
}

// A visual state's role for the student: can they open it right now?
export function isVisualStateInteractive(state: VisualState): boolean {
    return state === "available" || state === "next" || state === "inProgress" || state === "complete";
}
