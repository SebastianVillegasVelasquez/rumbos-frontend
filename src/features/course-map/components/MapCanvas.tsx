import { useEffect, useMemo, useRef, useState } from "react";
import Konva from "konva";
import { Stage, Layer, Image as KonvaImage, Line, Circle } from "react-konva";
import useImage from "use-image";
import { Minus, Plus, Scan } from "lucide-react";
import { DEFAULT_DESIGN_HEIGHT, DESIGN_WIDTH, type MapCanvasProps } from "../types/course-props.types.ts";
import { clampRelative, toDesignSpace, toRelativeSpace, type DesignSize } from "../coordinates.ts";
import { dominantAxis, normalizeWheelDelta } from "../viewport/math.ts";
import { useViewportController } from "../viewport/useViewportController.ts";
import { sharedTicker } from "../viewport/ticker.ts";
import BubbleVisual from "./BubbleVisual.tsx";
import { IconPickerPopover } from "./IconPickerPopover.tsx";
import { defaultIconForModname, type IconKey } from "../icons.ts";
import { deriveVisualState, nextIncompleteSequence, type VisualState } from "../visualState.ts";
import { resolveSkin } from "../resolveSkin.ts";
import type { RenderableBubble as BubbleModel, MapFit, MapSettings } from "../data/types.ts";
import { es } from "../../../i18n/es.ts";
import { IconButton } from "../../../components/ui/Button.tsx";
import { useAnimationQuality } from "../../../fx/quality.ts";
import { AmbientLayer } from "../../../fx/AmbientLayer.tsx";
import { isSegmentComplete, travelerTargetT } from "../../../fx/path.ts";
import { pointAtT } from "../../../fx/math/pointAtT.ts";
import { COMPLETION, PATH, TRANSITIONS } from "../../../fx/constants.ts";

const DEFAULT_PATH_SETTINGS: MapSettings["path"] = { visible: true, style: "dashed", color: null, animated: true };
const DEFAULT_AMBIENT_SETTINGS: MapSettings["ambient"] = { kind: "none", intensity: 0 };

const PATH_DASH: Record<MapSettings["path"]["style"], number[] | undefined> = {
    dashed: [PATH.dashLength, PATH.gapLength],
    dotted: [2, 7],
    solid: undefined,
};

const computeBaseScale = (fit: MapFit, viewport: { width: number; height: number }, design: DesignSize) => {
    if (design.width <= 0 || design.height <= 0 || viewport.width <= 0 || viewport.height <= 0) return 1;
    switch (fit) {
        case "original":
            return 1;
        case "fit-height":
            return viewport.height / design.height;
        case "contain":
            return Math.min(viewport.width / design.width, viewport.height / design.height);
        case "fit-width":
        default:
            return viewport.width / design.width;
    }
};

const prefersReducedMotion = () =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const BACKGROUND_NODE_NAME = "map-background";

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 1.15;
// Pinch-to-zoom (and some trackpad "zoom" gestures) arrive as ctrl/cmd+wheel
// with the pinch amount encoded in deltaY; this converts that into a
// per-event scale factor.
const WHEEL_ZOOM_SENSITIVITY = 0.0035;
const ARROW_PAN_STEP = 80;

const getTouchDistance = (touches: TouchList) =>
    Math.hypot(touches[1].clientX - touches[0].clientX, touches[1].clientY - touches[0].clientY);

export const MapCanvas = ({
    backgroundUrl,
    bubbles,
    editable,
    ariaLabel,
    fit = "fit-width",
    mapMode = "explorative",
    initialView = null,
    intro = "none",
    pathSettings = DEFAULT_PATH_SETTINGS,
    ambient = DEFAULT_AMBIENT_SETTINGS,
    skins = [],
    defaultSkinId = null,
    skinRules = [],
    onBubbleMove,
    onBubbleUpdate,
    onBubbleDelete,
    onActivityDrop,
    onBubbleClick,
    getUnavailableReason,
    getModnameForBubble,
    getAvailability,
    getResolvedActivity,
    focusBubbleId,
    onFocusHandled,
    onViewportChange,
}: MapCanvasProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<Konva.Stage | null>(null);
    const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1, zoomFactor: 1 });
    const [size, setSize] = useState({ width: 0, height: 0 });
    const [background] = useImage(backgroundUrl);
    const [iconPickerBubbleId, setIconPickerBubbleId] = useState<string | null>(null);
    const [hoveredBubbleId, setHoveredBubbleId] = useState<string | null>(null);
    const [focusPulse, setFocusPulse] = useState<{ bubbleId: string; key: number } | null>(null);
    const pathRef = useRef<Konva.Line>(null);
    const completedPathRef = useRef<Konva.Line>(null);
    const travelerRef = useRef<Konva.Circle>(null);

    // The design-space canvas follows the background image's own aspect
    // ratio (width is always fixed; height adapts), falling back to the
    // default 16:9-ish aspect before the image has loaded.
    const designSize: DesignSize = useMemo(
        () => ({
            width: DESIGN_WIDTH,
            height: background && background.width > 0 ? DESIGN_WIDTH * (background.height / background.width) : DEFAULT_DESIGN_HEIGHT,
        }),
        [background]
    );
    // Vertical is the primary scroll axis unless the fit mode can only move
    // horizontally (fit-height leaves no vertical room to pan).
    const primaryAxis: "x" | "y" = fit === "fit-height" ? "x" : "y";
    const nextSequence = useMemo(() => nextIncompleteSequence(bubbles), [bubbles]);
    const { tier } = useAnimationQuality();

    // Sequence order (not raw API order) is what the connector path and the
    // traveler dot follow.
    const sortedBubbles = useMemo(() => [...bubbles].sort((a, b) => a.sequence - b.sequence), [bubbles]);
    const sortedVisualStates = useMemo<VisualState[]>(
        () =>
            sortedBubbles.map((bubble) =>
                deriveVisualState({
                    status: bubble.status,
                    sequence: bubble.sequence,
                    mode: mapMode,
                    availability: getAvailability?.(bubble),
                    view: editable ? "editor" : "student",
                    nextIncompleteSequence: nextSequence,
                })
            ),
        [sortedBubbles, mapMode, getAvailability, editable, nextSequence]
    );
    const pathPoints = useMemo(
        () => sortedBubbles.flatMap((bubble) => { const p = toDesignSpace({ x: bubble.x, y: bubble.y }, designSize); return [p.x, p.y]; }),
        [sortedBubbles, designSize]
    );
    const visualStateById = useMemo(
        () => new Map(sortedBubbles.map((bubble, i) => [bubble.id, sortedVisualStates[i]])),
        [sortedBubbles, sortedVisualStates]
    );
    const [showLevelComplete, setShowLevelComplete] = useState(false);
    const burstLayerRef = useRef<Konva.Layer>(null);
    const wasAllCompleteRef = useRef<boolean | null>(null);

    // Stable for the component's lifetime (see useViewportController), so it
    // can be used directly in effects/handlers without a ref indirection.
    const controller = useViewportController({
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        onChange: setViewport,
    });

    const { x: stageX, y: stageY, scale, zoomFactor } = viewport;

    useEffect(() => {
        if (!onViewportChange || scale <= 0 || designSize.width <= 0 || designSize.height <= 0) return;
        const center = clampRelative({
            x: (size.width / 2 - stageX) / scale / designSize.width,
            y: (size.height / 2 - stageY) / scale / designSize.height,
        });
        onViewportChange({ x: center.x, y: center.y, zoom: zoomFactor });
    }, [onViewportChange, stageX, stageY, scale, zoomFactor, size, designSize]);

    // The Stage node is attached once it mounts; content size and base scale
    // react to the design size (background aspect ratio) and fit mode.
    useEffect(() => {
        controller.attachStage(stageRef.current);
        return () => controller.attachStage(null);
    }, [controller]);

    useEffect(() => {
        controller.setContentSize(designSize.width, designSize.height);
        controller.setBaseScale(computeBaseScale(fit, size, designSize));
    }, [controller, designSize, fit, size]);

    // Applies the map's saved initial view once, the first time the
    // viewport actually has a real size to fly within - never again after
    // that (so it doesn't fight the user's own panning/zooming later).
    const appliedInitialViewRef = useRef(false);
    useEffect(() => {
        if (appliedInitialViewRef.current || size.width <= 0 || size.height <= 0) return;
        appliedInitialViewRef.current = true;
        if (!initialView) return;
        const target = toDesignSpace({ x: initialView.x, y: initialView.y }, designSize);
        if (intro === "flyin") {
            controller.resetView(true);
            controller.flyTo(target.x, target.y, initialView.zoom);
        } else {
            controller.flyTo(target.x, target.y, initialView.zoom, 0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [size, designSize]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const observer = new ResizeObserver((entries) => {
            const { width, height } = entries[0].contentRect;
            setSize({ width, height });
            controller.setViewportSize(width, height);
        });
        observer.observe(container);
        return () => observer.disconnect();
    }, [controller]);

    // One-shot: center the viewport on a bubble requested from the
    // activities overview panel and give it a brief highlight pulse.
    useEffect(() => {
        if (focusBubbleId == null) return;
        const bubble = bubbles.find((b) => b.id === focusBubbleId);
        if (bubble) {
            const design = toDesignSpace({ x: bubble.x, y: bubble.y }, designSize);
            controller.flyTo(design.x, design.y, controller.getState().zoomFactor);
            // One-shot imperative reaction to an external request (not
            // derived render state), so a direct setState here is correct.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setFocusPulse({ bubbleId: focusBubbleId, key: Date.now() });
        }
        onFocusHandled?.();
        // Intentionally reacting only to focusBubbleId changing - bubbles are
        // read at trigger time, not tracked as a dep.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [focusBubbleId]);

    // Level completion celebration: fires only on an observed live
    // transition into "every bubble complete" (never on first load, via the
    // null-initialized ref), pulls the camera back to show the whole map,
    // and shows a brief banner plus a one-shot particle burst sized by
    // quality tier.
    useEffect(() => {
        if (bubbles.length === 0) return;
        const allComplete = bubbles.every((bubble) => bubble.status === "complete");
        const wasAllComplete = wasAllCompleteRef.current;
        wasAllCompleteRef.current = allComplete;
        if (wasAllComplete === null || wasAllComplete || !allComplete) return;
        if (tier === "off" || prefersReducedMotion()) return;

        controller.resetView();
        // One-shot imperative reaction to an observed live transition (not
        // derived render state), so a direct setState here is correct.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setShowLevelComplete(true);
        const hideTimeout = window.setTimeout(() => setShowLevelComplete(false), COMPLETION.bannerDurationMs);

        const burstLayer = burstLayerRef.current;
        const count = COMPLETION.celebration[tier];
        if (burstLayer && count > 0) {
            const centerX = designSize.width / 2;
            const centerY = designSize.height / 2;
            const palette = ["#ffd866", "#7de3a8", "#5ed3dd", "#ffffff"];
            for (let i = 0; i < count; i++) {
                const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
                const distance = 120 + Math.random() * 180;
                const particle = new Konva.Circle({
                    x: centerX,
                    y: centerY,
                    radius: 3 + Math.random() * 3,
                    fill: palette[i % palette.length],
                    opacity: 1,
                    listening: false,
                });
                burstLayer.add(particle);
                new Konva.Tween({
                    node: particle,
                    x: centerX + Math.cos(angle) * distance,
                    y: centerY + Math.sin(angle) * distance,
                    opacity: 0,
                    duration: TRANSITIONS.burstDurationS,
                    easing: Konva.Easings.EaseOut,
                    onFinish: () => particle.destroy(),
                }).play();
            }
        }

        return () => window.clearTimeout(hideTimeout);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bubbles, tier]);

    // Connector path ("camino") animation: a slow "energy flow" dash offset
    // on the whole path (faster/brighter on completed segments, via the
    // separate overlay line below) plus, at high quality, a light dot
    // traveling toward the "next" bubble. All driven off the shared ticker;
    // skipped entirely when animated=false, quality is "off", or
    // prefers-reduced-motion is set.
    useEffect(() => {
        const line = pathRef.current;
        const completedLine = completedPathRef.current;
        const traveler = travelerRef.current;
        const stage = line?.getStage();
        if (!line || !stage) return;
        const animated = pathSettings.animated && tier !== "off" && !prefersReducedMotion();

        if (!animated) {
            line.dashOffset(0);
            completedLine?.dashOffset(0);
            traveler?.visible(false);
            return;
        }

        const targetT = travelerTargetT(sortedVisualStates);
        const showTraveler = tier === "high" && targetT !== null && pathPoints.length >= 4;

        const unsubscribe = sharedTicker.subscribe(stage, (frame) => {
            line.dashOffset(-(frame.time * PATH.flowSpeedPxPerMs) % (PATH.dashLength + PATH.gapLength));
            if (completedLine) completedLine.dashOffset(-(frame.time * PATH.flowSpeedPxPerMs * 1.6) % (PATH.dashLength + PATH.gapLength));
            if (traveler && showTraveler && targetT !== null) {
                const loopT = ((frame.time % PATH.travelerPeriodMs) / PATH.travelerPeriodMs) * targetT;
                const point = pointAtT(pathPoints, loopT);
                if (point) {
                    traveler.visible(true);
                    traveler.x(point.x);
                    traveler.y(point.y);
                }
            } else {
                traveler?.visible(false);
            }
        });
        return unsubscribe;
    }, [pathSettings.animated, tier, sortedVisualStates, pathPoints]);

    // Single owner of wheel/pointer/touch/keyboard input, all funneled
    // through the viewport controller - see viewport/useViewportController.ts.
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const rect = container.getBoundingClientRect();
            const screenX = e.clientX - rect.left;
            const screenY = e.clientY - rect.top;

            if (e.ctrlKey || e.metaKey) {
                const factor = Math.exp(-e.deltaY * WHEEL_ZOOM_SENSITIVITY);
                controller.zoomAt(screenX, screenY, factor);
                return;
            }

            const { dx, dy } = normalizeWheelDelta(e, { width: rect.width, height: rect.height });
            const delta = dominantAxis(dx, dy) === "x" ? dx : dy;

            const secondaryAxis: "x" | "y" = primaryAxis === "y" ? "x" : "y";
            const targetAxis = e.shiftKey ? secondaryAxis : primaryAxis;
            const canPan = controller.canPan();
            if (!canPan[targetAxis]) return;
            // Scroll semantics: a positive delta (scrolling "forward") moves
            // the stage the opposite way, revealing content further along.
            if (targetAxis === "x") controller.panBy(-delta, 0);
            else controller.panBy(0, -delta);
        };

        container.addEventListener("wheel", onWheel, { passive: false });
        return () => container.removeEventListener("wheel", onWheel);
    }, [controller, primaryAxis]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const onKeyDown = (e: KeyboardEvent) => {
            const c = controller;
            // Scroll semantics (matching the wheel handler): "down"/"right"
            // reveal further content, so the stage moves the opposite way.
            switch (e.key) {
                case "ArrowUp":
                    c.panBy(0, ARROW_PAN_STEP);
                    break;
                case "ArrowDown":
                    c.panBy(0, -ARROW_PAN_STEP);
                    break;
                case "ArrowLeft":
                    c.panBy(ARROW_PAN_STEP, 0);
                    break;
                case "ArrowRight":
                    c.panBy(-ARROW_PAN_STEP, 0);
                    break;
                case "PageUp":
                    c.panBy(0, container.clientHeight * 0.9);
                    break;
                case "PageDown":
                    c.panBy(0, -container.clientHeight * 0.9);
                    break;
                case "Home":
                    c.panBy(0, 1e6);
                    break;
                case "End":
                    c.panBy(0, -1e6);
                    break;
                case "+":
                case "=":
                    c.setZoomFactor(c.getState().zoomFactor * ZOOM_STEP, container.clientWidth / 2, container.clientHeight / 2);
                    break;
                case "-":
                    c.setZoomFactor(c.getState().zoomFactor / ZOOM_STEP, container.clientWidth / 2, container.clientHeight / 2);
                    break;
                case "0":
                    c.resetView();
                    break;
                default:
                    return;
            }
            e.preventDefault();
        };

        container.addEventListener("keydown", onKeyDown);
        return () => container.removeEventListener("keydown", onKeyDown);
    }, [controller]);

    // Click-and-drag panning of empty canvas space, and two-finger pinch
    // zoom. Only starts when the gesture originates on the background image
    // or the Stage itself - a bubble's own Group intercepts the event first
    // when the gesture starts on a bubble, so this never fights bubble
    // dragging or the sidebar drop.
    const panRef = useRef<{ startX: number; startY: number } | null>(null);
    const pinchRef = useRef<{ distance: number; zoomFactor: number } | null>(null);

    const isBackgroundTarget = (target: Konva.Node) => {
        const stage = target.getStage();
        return target === stage || target.name() === BACKGROUND_NODE_NAME;
    };

    const beginPan = (clientX: number, clientY: number) => {
        setIconPickerBubbleId(null);
        panRef.current = { startX: clientX, startY: clientY };
        if (containerRef.current) containerRef.current.style.cursor = "grabbing";
    };

    const updatePan = (clientX: number, clientY: number) => {
        const pan = panRef.current;
        if (!pan) return;
        controller.panBy(clientX - pan.startX, clientY - pan.startY, { instant: true });
        panRef.current = { startX: clientX, startY: clientY };
    };

    const endPan = () => {
        if (!panRef.current) return;
        panRef.current = null;
        if (containerRef.current) containerRef.current.style.cursor = "default";
    };

    const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
        if (!isBackgroundTarget(e.target)) return;
        beginPan(e.evt.clientX, e.evt.clientY);
    };

    const handleStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
        if (!panRef.current) return;
        updatePan(e.evt.clientX, e.evt.clientY);
    };

    const handleStageTouchStart = (e: Konva.KonvaEventObject<TouchEvent>) => {
        if (e.evt.touches.length === 2) {
            pinchRef.current = {
                distance: getTouchDistance(e.evt.touches),
                zoomFactor: controller.getState().zoomFactor,
            };
            panRef.current = null;
            return;
        }
        if (e.evt.touches.length !== 1 || !isBackgroundTarget(e.target)) return;
        beginPan(e.evt.touches[0].clientX, e.evt.touches[0].clientY);
    };

    const handleStageTouchMove = (e: Konva.KonvaEventObject<TouchEvent>) => {
        const container = containerRef.current;
        if (e.evt.touches.length === 2 && pinchRef.current && container) {
            e.evt.preventDefault();
            const rect = container.getBoundingClientRect();
            const [t0, t1] = [e.evt.touches[0], e.evt.touches[1]];
            const midX = (t0.clientX + t1.clientX) / 2 - rect.left;
            const midY = (t0.clientY + t1.clientY) / 2 - rect.top;
            const distance = getTouchDistance(e.evt.touches);
            const factor = distance / pinchRef.current.distance;
            controller.zoomAt(midX, midY, factor, { instant: true });
            pinchRef.current = { distance, zoomFactor: controller.getState().zoomFactor };
            return;
        }
        if (!panRef.current || e.evt.touches.length !== 1) return;
        e.evt.preventDefault();
        updatePan(e.evt.touches[0].clientX, e.evt.touches[0].clientY);
    };

    const handleStageTouchEnd = (e: Konva.KonvaEventObject<TouchEvent>) => {
        if (e.evt.touches.length < 2) pinchRef.current = null;
        endPan();
    };

    const handleBubbleDragEnd = (bubbleId: string, pos: { x: number; y: number }) => {
        onBubbleMove?.(bubbleId, pos.x, pos.y);
    };

    const handleBubbleClick = (bubble: BubbleModel) => {
        if (editable) {
            setIconPickerBubbleId((current) => (current === bubble.id ? null : bubble.id));
        } else {
            onBubbleClick?.(bubble);
        }
    };

    const unavailableReasonFor = (bubble: BubbleModel) => (editable ? null : getUnavailableReason?.(bubble) ?? null);
    const iconFor = (bubble: BubbleModel): IconKey | undefined => {
        if (bubble.icon) return bubble.icon;
        const modname = getModnameForBubble?.(bubble);
        return modname ? defaultIconForModname(modname) : undefined;
    };
    const hoveredUnavailableBubble = bubbles.find((bubble) => bubble.id === hoveredBubbleId) ?? null;
    const hoveredUnavailableReason = hoveredUnavailableBubble ? unavailableReasonFor(hoveredUnavailableBubble) : null;

    const handleIconSelect = (bubbleId: string, icon: IconKey) => {
        onBubbleUpdate?.(bubbleId, { icon });
        setIconPickerBubbleId(null);
    };

    const handleStatusSelect = (bubbleId: string, status: BubbleModel["status"]) => {
        onBubbleUpdate?.(bubbleId, { status });
    };

    const handleDelete = (bubbleId: string) => {
        setIconPickerBubbleId(null);
        onBubbleDelete?.(bubbleId);
    };

    const iconPickerBubble = bubbles.find((bubble) => bubble.id === iconPickerBubbleId) ?? null;

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        if (!editable) return;
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        if (!editable) return;
        e.preventDefault();
        const raw = e.dataTransfer.getData("application/json");
        if (!raw) return;

        const { activityId } = JSON.parse(raw) as { activityId: number };
        const container = containerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const design = controller.screenToContent(e.clientX - rect.left, e.clientY - rect.top);
        const relative = clampRelative(toRelativeSpace(design, designSize));

        onActivityDrop?.(activityId, relative.x, relative.y);
    };

    const handleZoomButton = (factor: number) => {
        const container = containerRef.current;
        if (!container) return;
        controller.setZoomFactor(
            controller.getState().zoomFactor * factor,
            container.clientWidth / 2,
            container.clientHeight / 2
        );
    };

    const handleZoomReset = () => controller.resetView();

    return (
        <div className="relative h-full w-full">
            <div
                ref={containerRef}
                role="img"
                aria-label={ariaLabel ?? es.canvas.ariaLabel}
                tabIndex={0}
                className="relative h-full w-full overflow-hidden rounded-lg border border-ink/10 bg-surface-muted outline-none focus-visible:ring-2 focus-visible:ring-teal-dark [&::-webkit-scrollbar]:hidden"
                style={{ touchAction: "none", overscrollBehavior: "contain", scrollbarWidth: "none" }}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                <Stage
                    ref={stageRef}
                    width={size.width}
                    height={size.height}
                    x={stageX}
                    y={stageY}
                    scaleX={scale}
                    scaleY={scale}
                    onMouseDown={handleStageMouseDown}
                    onMouseMove={handleStageMouseMove}
                    onMouseUp={endPan}
                    onMouseLeave={endPan}
                    onTouchStart={handleStageTouchStart}
                    onTouchMove={handleStageTouchMove}
                    onTouchEnd={handleStageTouchEnd}
                >
                    <Layer>
                        <KonvaImage
                            name={BACKGROUND_NODE_NAME}
                            image={background}
                            width={designSize.width}
                            height={designSize.height}
                        />
                    </Layer>
                    <AmbientLayer kind={ambient.kind} intensity={ambient.intensity} designSize={designSize} tier={tier} />
                    <Layer listening={false}>
                        {pathSettings.visible && pathPoints.length >= 4 && (
                            <>
                                <Line
                                    ref={pathRef}
                                    points={pathPoints}
                                    stroke={pathSettings.color ?? "#0e9aa7"}
                                    strokeWidth={4}
                                    dash={PATH_DASH[pathSettings.style]}
                                    lineCap="round"
                                    lineJoin="round"
                                    opacity={0.55}
                                />
                                {sortedVisualStates.some((state, i) => i > 0 && isSegmentComplete(sortedVisualStates[i - 1], state)) && (
                                    <Line
                                        ref={completedPathRef}
                                        points={pathPoints.slice(
                                            0,
                                            (sortedVisualStates.findLastIndex((state) => state === "complete") + 1) * 2
                                        )}
                                        stroke={pathSettings.color ?? "#2fbf71"}
                                        strokeWidth={4}
                                        dash={PATH_DASH[pathSettings.style]}
                                        lineCap="round"
                                        lineJoin="round"
                                        opacity={0.85}
                                    />
                                )}
                                <Circle ref={travelerRef} radius={5} fill="#ffffff" shadowColor="#ffd866" shadowBlur={8} shadowOpacity={0.9} visible={false} />
                            </>
                        )}
                    </Layer>
                    <Layer>
                        {bubbles.map((bubble) => {
                            const modname = getModnameForBubble?.(bubble);
                            const visualState = visualStateById.get(bubble.id) ?? "locked";
                            const skin = resolveSkin({
                                bubbleSkinId: bubble.skinId,
                                modname,
                                skinRules,
                                defaultSkinId,
                                skins,
                            });
                            return (
                                <BubbleVisual
                                    key={bubble.id}
                                    x={bubble.x}
                                    y={bubble.y}
                                    designSize={designSize}
                                    visualState={visualState}
                                    skin={skin}
                                    icon={iconFor(bubble)}
                                    label={getResolvedActivity?.(bubble)?.name}
                                    draggable={editable}
                                    pulseKey={focusPulse?.bubbleId === bubble.id ? focusPulse.key : undefined}
                                    onClick={unavailableReasonFor(bubble) ? undefined : () => handleBubbleClick(bubble)}
                                    onHoverChange={(hovered) => setHoveredBubbleId(hovered ? bubble.id : null)}
                                    onDragStart={() => setIconPickerBubbleId(null)}
                                    onDragEnd={(pos) => handleBubbleDragEnd(bubble.id, pos)}
                                />
                            );
                        })}
                    </Layer>
                    <Layer ref={burstLayerRef} listening={false} />
                </Stage>
                {showLevelComplete && (
                    <div
                        role="status"
                        className="pointer-events-none absolute left-1/2 top-6 z-30 -translate-x-1/2 rounded-pill bg-leaf-dark px-5 py-2.5 text-sm font-semibold text-white shadow-soft"
                    >
                        {es.canvas.levelComplete}
                    </div>
                )}
                {hoveredUnavailableBubble && hoveredUnavailableReason && (
                    <div
                        role="tooltip"
                        className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[calc(100%+40px)] whitespace-nowrap rounded-md bg-ink px-2.5 py-1.5 text-xs font-medium text-white shadow-soft"
                        style={{
                            left: stageX + toDesignSpace({ x: hoveredUnavailableBubble.x, y: hoveredUnavailableBubble.y }, designSize).x * scale,
                            top: stageY + toDesignSpace({ x: hoveredUnavailableBubble.x, y: hoveredUnavailableBubble.y }, designSize).y * scale,
                        }}
                    >
                        {hoveredUnavailableReason}
                    </div>
                )}
                {iconPickerBubble && (
                    <IconPickerPopover
                        key={iconPickerBubble.id}
                        x={stageX + toDesignSpace({ x: iconPickerBubble.x, y: iconPickerBubble.y }, designSize).x * scale}
                        y={stageY + toDesignSpace({ x: iconPickerBubble.x, y: iconPickerBubble.y }, designSize).y * scale}
                        currentIcon={iconPickerBubble.icon ?? undefined}
                        currentStatus={iconPickerBubble.status}
                        availability={getAvailability?.(iconPickerBubble)}
                        resolvedActivity={getResolvedActivity?.(iconPickerBubble) ?? null}
                        onSelect={(icon) => handleIconSelect(iconPickerBubble.id, icon)}
                        onStatusSelect={(status) => handleStatusSelect(iconPickerBubble.id, status)}
                        onDelete={() => handleDelete(iconPickerBubble.id)}
                        onClose={() => setIconPickerBubbleId(null)}
                        skins={skins}
                        currentSkinId={iconPickerBubble.skinId}
                        onSkinSelect={(skinId) => onBubbleUpdate?.(iconPickerBubble.id, { skinId })}
                    />
                )}
            </div>
            <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1 rounded-pill bg-surface/95 p-1.5 shadow-soft backdrop-blur">
                <IconButton
                    onClick={() => handleZoomButton(1 / ZOOM_STEP)}
                    aria-label={es.canvas.zoomOut}
                    variant="ghost"
                    className="pointer-events-auto h-8 w-8 min-h-0 min-w-0"
                >
                    <Minus size={15} />
                </IconButton>
                <span className="pointer-events-auto min-w-[3rem] text-center text-xs font-medium text-ink-soft">
                    {Math.round(zoomFactor * 100)}%
                </span>
                <IconButton
                    onClick={() => handleZoomButton(ZOOM_STEP)}
                    aria-label={es.canvas.zoomIn}
                    variant="ghost"
                    className="pointer-events-auto h-8 w-8 min-h-0 min-w-0"
                >
                    <Plus size={15} />
                </IconButton>
                <IconButton
                    onClick={handleZoomReset}
                    aria-label={es.canvas.fitToScreen}
                    title={es.canvas.fitToScreen}
                    variant="ghost"
                    className="pointer-events-auto ml-1 h-8 w-8 min-h-0 min-w-0"
                >
                    <Scan size={15} />
                </IconButton>
            </div>
        </div>
    );
};
