export interface Point {
    x: number;
    y: number;
}

// The Stage's internal, zoom-independent coordinate system. Width is fixed;
// height follows the background image's own aspect ratio (see
// types/course-props.types.ts's DESIGN_WIDTH / DEFAULT_DESIGN_HEIGHT).
export interface DesignSize {
    width: number;
    height: number;
}

// Converts a bubble's stored 0-1 relative position into design-space pixels.
export function toDesignSpace(relative: Point, size: DesignSize): Point {
    return { x: relative.x * size.width, y: relative.y * size.height };
}

// Converts a design-space pixel position back into the 0-1 relative scale
// used by Bubble.
export function toRelativeSpace(design: Point, size: DesignSize): Point {
    return { x: design.x / size.width, y: design.y / size.height };
}

export function clampRelative(point: Point): Point {
    return {
        x: Math.min(Math.max(point.x, 0), 1),
        y: Math.min(Math.max(point.y, 0), 1),
    };
}
