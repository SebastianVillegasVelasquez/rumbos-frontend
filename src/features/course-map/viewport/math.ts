// Pure math for the map viewport: wheel normalization, axis locking, camera
// clamping and cursor-anchored zoom. Kept dependency-free (besides the
// shared easing module) so it's easy to reason about - and test, if a
// runner is ever added - in isolation from Konva and React.

export { easeOutCubic } from "../../../fx/math/easing.ts";

export interface Size {
    width: number;
    height: number;
}

export interface Camera {
    x: number;
    y: number;
    scale: number;
}

export interface Bounds {
    contentWidth: number;
    contentHeight: number;
    viewportWidth: number;
    viewportHeight: number;
}

export const clampNum = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const LINE_HEIGHT_PX = 16;
const MAX_WHEEL_DELTA = 120;

// Normalizes a wheel event's delta to pixels (deltaMode 0/1/2 = pixel/line/
// page) and caps the magnitude of a single event so OS-level acceleration or
// a fast physical wheel can't throw the camera across the map in one notch.
export function normalizeWheelDelta(
    delta: { deltaX: number; deltaY: number; deltaMode: number },
    viewport: Size
): { dx: number; dy: number } {
    let dx = delta.deltaX;
    let dy = delta.deltaY;
    if (delta.deltaMode === 1) {
        dx *= LINE_HEIGHT_PX;
        dy *= LINE_HEIGHT_PX;
    } else if (delta.deltaMode === 2) {
        dx *= viewport.width;
        dy *= viewport.height;
    }
    return {
        dx: clampNum(dx, -MAX_WHEEL_DELTA, MAX_WHEEL_DELTA),
        dy: clampNum(dy, -MAX_WHEEL_DELTA, MAX_WHEEL_DELTA),
    };
}

// Picks a single axis so a plain wheel notch never drifts diagonally.
export function dominantAxis(dx: number, dy: number): "x" | "y" {
    return Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
}

export function canPanAxis(contentSize: number, viewportSize: number): boolean {
    return contentSize > viewportSize + 0.5;
}

// Clamps one axis of a camera position: centers the content when it fits the
// viewport (no panning possible), otherwise keeps the content's edges from
// leaving the viewport (with an optional outward margin, in px).
export function clampAxis(pos: number, contentSize: number, viewportSize: number, margin = 0): number {
    if (contentSize <= viewportSize) return (viewportSize - contentSize) / 2;
    const min = viewportSize - contentSize - margin;
    const max = margin;
    return clampNum(pos, min, max);
}

export function clampCamera(camera: Camera, bounds: Bounds, margin = 0): Camera {
    const contentW = bounds.contentWidth * camera.scale;
    const contentH = bounds.contentHeight * camera.scale;
    return {
        scale: camera.scale,
        x: clampAxis(camera.x, contentW, bounds.viewportWidth, margin),
        y: clampAxis(camera.y, contentH, bounds.viewportHeight, margin),
    };
}

// Zooms around a screen-space point (e.g. the cursor), keeping the content
// point under it fixed.
export function zoomAtPoint(
    camera: Camera,
    screenPoint: { x: number; y: number },
    factor: number,
    minScale: number,
    maxScale: number
): Camera {
    const nextScale = clampNum(camera.scale * factor, minScale, maxScale);
    if (nextScale === camera.scale) return camera;
    const contentX = (screenPoint.x - camera.x) / camera.scale;
    const contentY = (screenPoint.y - camera.y) / camera.scale;
    return {
        scale: nextScale,
        x: screenPoint.x - contentX * nextScale,
        y: screenPoint.y - contentY * nextScale,
    };
}

export function camerasClose(a: Camera, b: Camera, posEps = 0.25, scaleEps = 0.0005): boolean {
    return Math.abs(a.x - b.x) < posEps && Math.abs(a.y - b.y) < posEps && Math.abs(a.scale - b.scale) < scaleEps;
}
