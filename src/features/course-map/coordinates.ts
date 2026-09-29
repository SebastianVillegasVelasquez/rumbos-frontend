import { DESIGN_HEIGHT, DESIGN_WIDTH } from "./types/course-props.types.ts";

export interface Point {
    x: number;
    y: number;
}

// Converts a bubble's stored 0-1 relative position into design-space pixels
// (the Stage's internal, zoom-independent 1600x900 coordinate system).
export function toDesignSpace(relative: Point): Point {
    return { x: relative.x * DESIGN_WIDTH, y: relative.y * DESIGN_HEIGHT };
}

// Converts a design-space pixel position back into the 0-1 relative scale
// used by BubbleData.
export function toRelativeSpace(design: Point): Point {
    return { x: design.x / DESIGN_WIDTH, y: design.y / DESIGN_HEIGHT };
}

export function clampRelative(point: Point): Point {
    return {
        x: Math.min(Math.max(point.x, 0), 1),
        y: Math.min(Math.max(point.y, 0), 1),
    };
}
