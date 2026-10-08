import type { VisualState } from "../features/course-map/visualState.ts";

// A path segment is "flowing" (energy-flow dash animation) once the bubble
// it leads to is complete - it reads as "this part of the journey is done".
export function isSegmentComplete(fromState: VisualState, toState: VisualState): boolean {
    return fromState === "complete" && toState === "complete";
}

// t (0..1) for the traveler dot: a point that loops along the whole path
// toward the "next" bubble. Returns null when there's no meaningful target
// (no bubble in "next" state, e.g. explorative mode or nothing left to do).
export function travelerTargetT(visualStates: VisualState[]): number | null {
    const nextIndex = visualStates.findIndex((state) => state === "next");
    if (nextIndex === -1 || visualStates.length < 2) return null;
    return nextIndex / (visualStates.length - 1);
}
