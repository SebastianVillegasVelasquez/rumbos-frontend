import { useEffect, useRef, useState } from "react";
import KonvaLib from "konva";
import { Stage, Layer, Image as KonvaImage, Line } from "react-konva";
import type Konva from "konva";
import useImage from "use-image";
import { Minus, Plus, Scan } from "lucide-react";
import { DESIGN_HEIGHT, DESIGN_WIDTH, type MapCanvasProps } from "../types/course-props.types.ts";
import { clampRelative, toDesignSpace, toRelativeSpace } from "../coordinates.ts";
import { dominantAxis, normalizeWheelDelta } from "../viewport/math.ts";
import { useViewportController } from "../viewport/useViewportController.ts";
import Bubble from "./Bubble.tsx";
import { IconPickerPopover } from "./IconPickerPopover.tsx";
import { defaultIconForModname, type IconKey } from "../icons.ts";
import type { Bubble as BubbleModel } from "../data/types.ts";
import { es } from "../../../i18n/es.ts";
import { IconButton } from "../../../components/ui/Button.tsx";

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

    // Stable for the component's lifetime (see useViewportController), so it
    // can be used directly in effects/handlers without a ref indirection.
    const controller = useViewportController({
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        onChange: setViewport,
    });

    const { x: stageX, y: stageY, scale, zoomFactor } = viewport;

    // One-time wiring: content size never changes (design space is fixed),
    // the Stage node is attached once it mounts, and viewport/base-scale
    // react to the container's actual size.
    useEffect(() => {
        controller.setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT);
        controller.attachStage(stageRef.current);
        return () => controller.attachStage(null);
    }, [controller]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const observer = new ResizeObserver((entries) => {
            const { width, height } = entries[0].contentRect;
            setSize({ width, height });
            controller.setViewportSize(width, height);
            controller.setBaseScale(width / DESIGN_WIDTH);
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
            const design = toDesignSpace({ x: bubble.x, y: bubble.y });
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

    // Slow marching-ants animation on the connector path ("camino"); skipped
    // entirely under prefers-reduced-motion. (Migrates onto the shared
    // ticker in Part 2 alongside the rest of the fx engine.)
    useEffect(() => {
        const line = pathRef.current;
        if (!line || prefersReducedMotion()) return;
        const anim = new KonvaLib.Animation((frame) => {
            if (!frame) return;
            line.dashOffset(-(frame.time / 35) % 24);
        }, line.getLayer());
        anim.start();
        return () => {
            anim.stop();
        };
    }, [bubbles.length]);

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

            // Primary axis is vertical for now (the current layout is always
            // fit-width); Part 1's fit modes make this fit-mode-dependent.
            const targetAxis: "x" | "y" = e.shiftKey ? "x" : "y";
            const canPan = controller.canPan();
            if (!canPan[targetAxis]) return;
            // Scroll semantics: a positive delta (scrolling "forward") moves
            // the stage the opposite way, revealing content further along.
            if (targetAxis === "x") controller.panBy(-delta, 0);
            else controller.panBy(0, -delta);
        };

        container.addEventListener("wheel", onWheel, { passive: false });
        return () => container.removeEventListener("wheel", onWheel);
    }, [controller]);

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
        const relative = clampRelative(toRelativeSpace(design));

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
                aria-label={es.canvas.ariaLabel}
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
                            width={DESIGN_WIDTH}
                            height={DESIGN_HEIGHT}
                        />
                    </Layer>
                    <Layer listening={false}>
                        {bubbles.length > 1 && (
                            <Line
                                ref={pathRef}
                                points={bubbles.flatMap((bubble) => {
                                    const point = toDesignSpace({ x: bubble.x, y: bubble.y });
                                    return [point.x, point.y];
                                })}
                                stroke="#0e9aa7"
                                strokeWidth={4}
                                dash={[16, 10]}
                                lineCap="round"
                                lineJoin="round"
                                opacity={0.55}
                            />
                        )}
                    </Layer>
                    <Layer>
                        {bubbles.map((bubble) => {
                            const availability = getAvailability?.(bubble);
                            return (
                                <Bubble
                                    key={bubble.id}
                                    x={bubble.x}
                                    y={bubble.y}
                                    status={bubble.status}
                                    icon={iconFor(bubble)}
                                    draggable={editable}
                                    muted={!editable && (availability === "hidden" || availability === "missing")}
                                    warningRing={editable && availability === "missing"}
                                    pulseKey={focusPulse?.bubbleId === bubble.id ? focusPulse.key : undefined}
                                    onClick={unavailableReasonFor(bubble) ? undefined : () => handleBubbleClick(bubble)}
                                    onHoverChange={(hovered) => setHoveredBubbleId(hovered ? bubble.id : null)}
                                    onDragStart={() => setIconPickerBubbleId(null)}
                                    onDragEnd={(pos) => handleBubbleDragEnd(bubble.id, pos)}
                                />
                            );
                        })}
                    </Layer>
                </Stage>
                {hoveredUnavailableBubble && hoveredUnavailableReason && (
                    <div
                        role="tooltip"
                        className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[calc(100%+40px)] whitespace-nowrap rounded-md bg-ink px-2.5 py-1.5 text-xs font-medium text-white shadow-soft"
                        style={{
                            left: stageX + toDesignSpace({ x: hoveredUnavailableBubble.x, y: hoveredUnavailableBubble.y }).x * scale,
                            top: stageY + toDesignSpace({ x: hoveredUnavailableBubble.x, y: hoveredUnavailableBubble.y }).y * scale,
                        }}
                    >
                        {hoveredUnavailableReason}
                    </div>
                )}
                {iconPickerBubble && (
                    <IconPickerPopover
                        key={iconPickerBubble.id}
                        x={stageX + toDesignSpace({ x: iconPickerBubble.x, y: iconPickerBubble.y }).x * scale}
                        y={stageY + toDesignSpace({ x: iconPickerBubble.x, y: iconPickerBubble.y }).y * scale}
                        currentIcon={iconPickerBubble.icon ?? undefined}
                        currentStatus={iconPickerBubble.status}
                        availability={getAvailability?.(iconPickerBubble)}
                        resolvedActivity={getResolvedActivity?.(iconPickerBubble) ?? null}
                        onSelect={(icon) => handleIconSelect(iconPickerBubble.id, icon)}
                        onStatusSelect={(status) => handleStatusSelect(iconPickerBubble.id, status)}
                        onDelete={() => handleDelete(iconPickerBubble.id)}
                        onClose={() => setIconPickerBubbleId(null)}
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
