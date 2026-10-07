import { useEffect, useMemo, useRef } from "react";
import type Konva from "konva";
import {
    camerasClose,
    clampAxis,
    clampCamera,
    clampNum,
    easeOutCubic,
    lerp,
    zoomAtPoint,
    type Camera,
} from "./math.ts";
import { sharedTicker } from "./ticker.ts";

const SMOOTH_MS = 120;
// Exponential-decay smoothing: after SMOOTH_MS the remaining gap is this
// fraction of the original, giving the same "short lerp" feel regardless of
// frame rate.
const SMOOTH_REMAINING_FRACTION = 0.03;

interface FlyToAnim {
    from: Camera;
    to: Camera;
    start: number;
    duration: number;
    easing: (t: number) => number;
}

export interface ViewportState extends Camera {
    zoomFactor: number;
}

export interface ViewportOptions {
    minZoom?: number;
    maxZoom?: number;
    // Outward margin (px) the content's edge may be panned past before
    // clamping kicks back in.
    margin?: number;
    onChange?: (state: ViewportState) => void;
}

// Owns the camera (x, y, scale) imperatively - the Stage's position/scale are
// pushed directly in the shared ticker's tick, never read back into React
// state on every frame. React only hears about a change via onChange, and
// only when the camera actually moved. This is the single owner of pan/zoom:
// MapCanvas's wheel/pointer/keyboard handlers all funnel through this.
export function useViewportController(options: ViewportOptions = {}) {
    const { minZoom = 1, maxZoom = 3, margin = 0 } = options;
    const optionsRef = useRef(options);
    useEffect(() => {
        optionsRef.current = options;
    });

    const stageRef = useRef<Konva.Stage | null>(null);
    const baseScaleRef = useRef(1);
    const contentSizeRef = useRef({ width: 0, height: 0 });
    const viewportSizeRef = useRef({ width: 0, height: 0 });

    const posRef = useRef<Camera>({ x: 0, y: 0, scale: 1 });
    const zoomFactorRef = useRef(1);
    const smoothTargetRef = useRef<Camera | null>(null);
    const flyToRef = useRef<FlyToAnim | null>(null);
    const lastReportedRef = useRef<ViewportState | null>(null);
    const reducedMotionRef = useRef(false);

    const bounds = () => ({
        contentWidth: contentSizeRef.current.width,
        contentHeight: contentSizeRef.current.height,
        viewportWidth: viewportSizeRef.current.width,
        viewportHeight: viewportSizeRef.current.height,
    });

    const applyToStage = () => {
        const stage = stageRef.current;
        if (!stage) return;
        const { x, y, scale } = posRef.current;
        stage.position({ x, y });
        stage.scale({ x: scale, y: scale });
    };

    const report = () => {
        const state: ViewportState = { ...posRef.current, zoomFactor: zoomFactorRef.current };
        const last = lastReportedRef.current;
        if (last && camerasClose(last, state) && last.zoomFactor === state.zoomFactor) return;
        lastReportedRef.current = state;
        optionsRef.current.onChange?.(state);
    };

    const setPos = (camera: Camera, options2: { clampIt?: boolean } = {}) => {
        const next = options2.clampIt === false ? camera : clampCamera(camera, bounds(), margin);
        posRef.current = next;
        zoomFactorRef.current = baseScaleRef.current > 0 ? next.scale / baseScaleRef.current : 1;
        applyToStage();
        report();
    };

    const cancelMotion = () => {
        flyToRef.current = null;
        smoothTargetRef.current = null;
    };

    const tick = (frame: { time: number; timeDiff: number }) => {
        if (flyToRef.current) {
            const anim = flyToRef.current;
            const t = clampNum((frame.time - anim.start) / anim.duration, 0, 1);
            const eased = anim.easing(t);
            const camera: Camera = {
                x: lerp(anim.from.x, anim.to.x, eased),
                y: lerp(anim.from.y, anim.to.y, eased),
                scale: lerp(anim.from.scale, anim.to.scale, eased),
            };
            setPos(camera, { clampIt: false });
            if (t >= 1) flyToRef.current = null;
            return;
        }
        if (smoothTargetRef.current) {
            const target = smoothTargetRef.current;
            const dt = Math.min(frame.timeDiff, 48);
            const factor = 1 - Math.pow(SMOOTH_REMAINING_FRACTION, dt / SMOOTH_MS);
            const next: Camera = {
                x: lerp(posRef.current.x, target.x, factor),
                y: lerp(posRef.current.y, target.y, factor),
                scale: lerp(posRef.current.scale, target.scale, factor),
            };
            setPos(next);
            if (camerasClose(posRef.current, target)) {
                smoothTargetRef.current = null;
                setPos(target);
            }
        }
    };

    useEffect(() => {
        reducedMotionRef.current =
            typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }, []);

    const unsubscribeRef = useRef<(() => void) | null>(null);

    const attachStage = (stage: Konva.Stage | null) => {
        unsubscribeRef.current?.();
        unsubscribeRef.current = null;
        stageRef.current = stage;
        if (stage) {
            applyToStage();
            unsubscribeRef.current = sharedTicker.subscribe(stage, tick);
        }
    };

    const setContentSize = (width: number, height: number) => {
        contentSizeRef.current = { width, height };
        setPos(posRef.current);
    };

    const setViewportSize = (width: number, height: number) => {
        viewportSizeRef.current = { width, height };
        setPos(posRef.current);
    };

    // Called on resize: updates the base ("100%") scale while preserving the
    // user's current zoom factor and, as closely as clamping allows, their
    // current framing.
    const setBaseScale = (nextBaseScale: number) => {
        const prevBase = baseScaleRef.current;
        baseScaleRef.current = nextBaseScale;
        const zoomFactor = prevBase > 0 ? zoomFactorRef.current : 1;
        setPos({ ...posRef.current, scale: nextBaseScale * zoomFactor });
    };

    const instantOrSmooth = (camera: Camera, instant: boolean) => {
        cancelMotion();
        if (instant || reducedMotionRef.current) {
            setPos(camera);
        } else {
            smoothTargetRef.current = clampCamera(camera, bounds(), margin);
        }
    };

    // Moves the stage directly by (dx, dy) - i.e. content follows the
    // gesture, the convention a drag or pinch needs. Wheel/keyboard "scroll"
    // semantics (content moves opposite to the perceived scroll direction)
    // are the caller's responsibility: negate the delta before calling.
    const panBy = (dx: number, dy: number, options2: { instant?: boolean } = {}) => {
        const base = smoothTargetRef.current ?? posRef.current;
        instantOrSmooth({ ...base, x: base.x + dx, y: base.y + dy }, options2.instant ?? false);
    };

    const zoomAt = (screenX: number, screenY: number, factor: number, options2: { instant?: boolean } = {}) => {
        const base = smoothTargetRef.current ?? posRef.current;
        const minScale = baseScaleRef.current * minZoom;
        const maxScale = baseScaleRef.current * maxZoom;
        const next = zoomAtPoint(base, { x: screenX, y: screenY }, factor, minScale, maxScale);
        instantOrSmooth(next, options2.instant ?? false);
    };

    const setZoomFactor = (factor: number, screenX: number, screenY: number) => {
        const clamped = clampNum(factor, minZoom, maxZoom);
        const currentFactor = zoomFactorRef.current || 1;
        if (currentFactor === 0) return;
        zoomAt(screenX, screenY, clamped / currentFactor);
    };

    const flyTo = (
        x: number,
        y: number,
        zoomFactor: number,
        durationMs = 420,
        easing: (t: number) => number = easeOutCubic
    ) => {
        cancelMotion();
        const scale = baseScaleRef.current * clampNum(zoomFactor, minZoom, maxZoom);
        const vw = viewportSizeRef.current.width;
        const vh = viewportSizeRef.current.height;
        const to = clampCamera({ x: vw / 2 - x * scale, y: vh / 2 - y * scale, scale }, bounds(), margin);
        if (reducedMotionRef.current) {
            setPos(to);
            return;
        }
        flyToRef.current = { from: posRef.current, to, start: performance.now(), duration: durationMs, easing };
    };

    const resetView = (instant = false) => {
        instantOrSmooth({ x: 0, y: 0, scale: baseScaleRef.current }, instant);
    };

    const screenToContent = (screenX: number, screenY: number) => {
        const { x, y, scale } = posRef.current;
        return { x: (screenX - x) / scale, y: (screenY - y) / scale };
    };

    const canPan = () => {
        const b = bounds();
        return {
            x: b.contentWidth * posRef.current.scale > b.viewportWidth + 0.5,
            y: b.contentHeight * posRef.current.scale > b.viewportHeight + 0.5,
        };
    };

    const getState = (): ViewportState => ({ ...posRef.current, zoomFactor: zoomFactorRef.current });

    const clampEdge = (axis: "x" | "y", value: number) => {
        const b = bounds();
        return axis === "x"
            ? clampAxis(value, b.contentWidth * posRef.current.scale, b.viewportWidth, margin)
            : clampAxis(value, b.contentHeight * posRef.current.scale, b.viewportHeight, margin);
    };

    // tick() no-ops when nothing is animating, so the idle subscription cost
    // (held for as long as a Stage is attached) is a handful of comparisons
    // per frame, not a second RAF loop.
    useEffect(() => () => unsubscribeRef.current?.(), []);

    return useMemo(
        () => ({
            attachStage,
            setContentSize,
            setViewportSize,
            setBaseScale,
            panBy,
            zoomAt,
            setZoomFactor,
            flyTo,
            resetView,
            screenToContent,
            canPan,
            clampEdge,
            cancelMotion,
            getState,
        }),
        // Every function above closes over refs only, so identity is stable
        // for the controller's lifetime - this memo just avoids recreating
        // the object literal every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    );
}

export type ViewportController = ReturnType<typeof useViewportController>;
