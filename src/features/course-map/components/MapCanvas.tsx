import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Line } from "react-konva";
import type Konva from "konva";
import useImage from "use-image";
import {DESIGN_HEIGHT, DESIGN_WIDTH, type MapCanvasProps} from "../types/course-props.types.ts";
import {clampRelative, toDesignSpace, toRelativeSpace} from "../coordinates.ts";
import Bubble from "./Bubble.tsx";
import { IconPickerPopover } from "./IconPickerPopover.tsx";
import type { IconKey } from "../icons.ts";
import type { Bubble as BubbleModel } from "../data/types.ts";

const BACKGROUND_NODE_NAME = "map-background";

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 1.15;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const ZOOM_ANIM_DURATION = 180;

const getTouchDistance = (touches: TouchList) =>
    Math.hypot(touches[1].clientX - touches[0].clientX, touches[1].clientY - touches[0].clientY);

// Converts a screen point into content-space pixels (design-space * effective
// scale), independent of the container's current scroll position.
const getContentPoint = (container: HTMLDivElement, scale: number, clientX: number, clientY: number) => {
    const rect = container.getBoundingClientRect();
    return {
        x: (clientX - rect.left + container.scrollLeft) / scale,
        y: (clientY - rect.top + container.scrollTop) / scale,
    };
};

// Scrolls the container so that the given content-space point lands back
// under the given screen point, at the container's current scale.
const scrollToContentPoint = (
    container: HTMLDivElement,
    scale: number,
    content: { x: number; y: number },
    clientX: number,
    clientY: number
) => {
    const rect = container.getBoundingClientRect();
    container.scrollLeft = content.x * scale - (clientX - rect.left);
    container.scrollTop = content.y * scale - (clientY - rect.top);
};

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
    focusBubbleId,
    onFocusHandled,
}: MapCanvasProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [fitScale, setFitScale] = useState(1);
    const [zoom, setZoom] = useState(1);
    const [background] = useImage(backgroundUrl);
    const [iconPickerBubbleId, setIconPickerBubbleId] = useState<string | null>(null);
    const [hoveredBubbleId, setHoveredBubbleId] = useState<string | null>(null);
    const [focusPulse, setFocusPulse] = useState<{ bubbleId: string; key: number } | null>(null);

    // Kept in sync with state so the native wheel/touch listeners below
    // (attached once) always read the latest values without re-attaching.
    const fitScaleRef = useRef(fitScale);
    const zoomRef = useRef(zoom);
    useEffect(() => {
        fitScaleRef.current = fitScale;
    }, [fitScale]);
    useEffect(() => {
        zoomRef.current = zoom;
    }, [zoom]);

    const scale = fitScale * zoom;

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const observer = new ResizeObserver((entries) => {
            const { width } = entries[0].contentRect;
            setFitScale(width / DESIGN_WIDTH);
        });

        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    // One-shot: center the viewport on a bubble requested from the
    // activities overview panel and give it a brief highlight pulse.
    useEffect(() => {
        if (focusBubbleId == null) return;
        const container = containerRef.current;
        const bubble = bubbles.find((b) => b.id === focusBubbleId);
        if (container && bubble) {
            const design = toDesignSpace({ x: bubble.x, y: bubble.y });
            const currentScale = fitScaleRef.current * zoomRef.current;
            const rect = container.getBoundingClientRect();
            container.scrollTo({
                left: design.x * currentScale - rect.width / 2,
                top: design.y * currentScale - rect.height / 2,
                behavior: "smooth",
            });
            setFocusPulse({ bubbleId: focusBubbleId, key: Date.now() });
        }
        onFocusHandled?.();
        // Intentionally reacting only to focusBubbleId changing - bubbles/
        // scale are read at trigger time, not tracked as deps.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [focusBubbleId]);

    // Smoothly tweens zoom (and the anchored scroll position that keeps a
    // content point fixed under the pointer) instead of snapping in one
    // frame - used by the wheel's per-notch step and the +/-/reset buttons.
    // Pinch-zoom is already continuous (driven by the gesture itself) so it
    // doesn't need this.
    const zoomAnimRef = useRef<number | null>(null);

    const animateZoomTo = (targetZoom: number, clientX: number, clientY: number) => {
        const container = containerRef.current;
        if (!container) return;
        if (zoomAnimRef.current !== null) cancelAnimationFrame(zoomAnimRef.current);

        const startZoom = zoomRef.current;
        if (startZoom === targetZoom) return;
        const startScale = fitScaleRef.current * startZoom;
        const content = getContentPoint(container, startScale, clientX, clientY);
        const startTime = performance.now();

        const step = (now: number) => {
            const t = clamp((now - startTime) / ZOOM_ANIM_DURATION, 0, 1);
            const eased = easeOutCubic(t);
            const nextZoom = startZoom + (targetZoom - startZoom) * eased;
            setZoom(nextZoom);
            scrollToContentPoint(container, fitScaleRef.current * nextZoom, content, clientX, clientY);
            zoomAnimRef.current = t < 1 ? requestAnimationFrame(step) : null;
        };
        zoomAnimRef.current = requestAnimationFrame(step);
    };

    useEffect(() => () => {
        if (zoomAnimRef.current !== null) cancelAnimationFrame(zoomAnimRef.current);
    }, []);

    // Cursor-anchored wheel zoom (desktop) and two-finger pinch zoom (touch),
    // scoped to the Stage's view only - bubble positions stay in the 0-1
    // relative scale and never know zoom happened.
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
            const prevZoom = zoomRef.current;
            const nextZoom = clamp(prevZoom * factor, MIN_ZOOM, MAX_ZOOM);
            if (nextZoom === prevZoom) return;
            animateZoomTo(nextZoom, e.clientX, e.clientY);
        };

        let pinch: { distance: number; zoom: number; content: { x: number; y: number }; midX: number; midY: number } | null = null;

        const onTouchStart = (e: TouchEvent) => {
            if (e.touches.length !== 2) return;
            const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            const scaleAtStart = fitScaleRef.current * zoomRef.current;
            pinch = {
                distance: getTouchDistance(e.touches),
                zoom: zoomRef.current,
                content: getContentPoint(container, scaleAtStart, midX, midY),
                midX,
                midY,
            };
        };

        const onTouchMove = (e: TouchEvent) => {
            if (e.touches.length !== 2 || !pinch) return;
            e.preventDefault();
            const distance = getTouchDistance(e.touches);
            const nextZoom = clamp(pinch.zoom * (distance / pinch.distance), MIN_ZOOM, MAX_ZOOM);
            setZoom(nextZoom);
            const { content, midX, midY } = pinch;
            requestAnimationFrame(() => {
                const nextScale = fitScaleRef.current * nextZoom;
                scrollToContentPoint(container, nextScale, content, midX, midY);
            });
        };

        const onTouchEnd = (e: TouchEvent) => {
            if (e.touches.length < 2) pinch = null;
        };

        container.addEventListener("wheel", onWheel, { passive: false });
        container.addEventListener("touchstart", onTouchStart, { passive: true });
        container.addEventListener("touchmove", onTouchMove, { passive: false });
        container.addEventListener("touchend", onTouchEnd);
        container.addEventListener("touchcancel", onTouchEnd);

        return () => {
            container.removeEventListener("wheel", onWheel);
            container.removeEventListener("touchstart", onTouchStart);
            container.removeEventListener("touchmove", onTouchMove);
            container.removeEventListener("touchend", onTouchEnd);
            container.removeEventListener("touchcancel", onTouchEnd);
        };
    }, []);

    const handleZoomButton = (factor: number) => {
        const container = containerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const clientX = rect.left + rect.width / 2;
        const clientY = rect.top + rect.height / 2;
        const nextZoom = clamp(zoomRef.current * factor, MIN_ZOOM, MAX_ZOOM);
        animateZoomTo(nextZoom, clientX, clientY);
    };

    const handleZoomReset = () => {
        const container = containerRef.current;
        if (!container) return;
        if (zoomAnimRef.current !== null) cancelAnimationFrame(zoomAnimRef.current);

        const startZoom = zoomRef.current;
        const startScrollLeft = container.scrollLeft;
        const startScrollTop = container.scrollTop;
        const startTime = performance.now();

        const step = (now: number) => {
            const t = clamp((now - startTime) / ZOOM_ANIM_DURATION, 0, 1);
            const eased = easeOutCubic(t);
            setZoom(startZoom + (1 - startZoom) * eased);
            container.scrollLeft = startScrollLeft * (1 - eased);
            container.scrollTop = startScrollTop * (1 - eased);
            zoomAnimRef.current = t < 1 ? requestAnimationFrame(step) : null;
        };
        zoomAnimRef.current = requestAnimationFrame(step);
    };

    // Click-and-drag panning of empty canvas space. Only starts when the
    // gesture originates on the background image or the Stage itself - a
    // bubble's own Group intercepts the event first when the gesture starts
    // on a bubble, so this never fights bubble dragging or the sidebar drop.
    // Panning moves the container's native scroll offset (same mechanism
    // family as wheel/pinch zoom above), which also gives us free clamping:
    // the browser won't scroll past the content's bounds.
    const panRef = useRef<{ startX: number; startY: number; startScrollLeft: number; startScrollTop: number } | null>(
        null
    );

    const isBackgroundTarget = (target: Konva.Node) => {
        const stage = target.getStage();
        return target === stage || target.name() === BACKGROUND_NODE_NAME;
    };

    const beginPan = (clientX: number, clientY: number) => {
        const container = containerRef.current;
        if (!container) return;
        setIconPickerBubbleId(null);
        panRef.current = {
            startX: clientX,
            startY: clientY,
            startScrollLeft: container.scrollLeft,
            startScrollTop: container.scrollTop,
        };
        container.style.cursor = "grabbing";
    };

    const updatePan = (clientX: number, clientY: number) => {
        const pan = panRef.current;
        const container = containerRef.current;
        if (!pan || !container) return;
        container.scrollLeft = pan.startScrollLeft - (clientX - pan.startX);
        container.scrollTop = pan.startScrollTop - (clientY - pan.startY);
    };

    const endPan = () => {
        if (!panRef.current) return;
        panRef.current = null;
        const container = containerRef.current;
        if (container) container.style.cursor = "default";
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
        // Two-finger touches are pinch-zoom, handled by the native listeners
        // above - only a single touch on the background starts a pan.
        if (e.evt.touches.length !== 1 || !isBackgroundTarget(e.target)) return;
        beginPan(e.evt.touches[0].clientX, e.evt.touches[0].clientY);
    };

    const handleStageTouchMove = (e: Konva.KonvaEventObject<TouchEvent>) => {
        if (!panRef.current || e.evt.touches.length !== 1) return;
        e.evt.preventDefault();
        updatePan(e.evt.touches[0].clientX, e.evt.touches[0].clientY);
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
        const design = {
            x: (e.clientX - rect.left + container.scrollLeft) / scale,
            y: (e.clientY - rect.top + container.scrollTop) / scale,
        };
        const relative = clampRelative(toRelativeSpace(design));

        onActivityDrop?.(activityId, relative.x, relative.y);
    };

    return (
        <div className="relative h-full w-full">
            <div
                ref={containerRef}
                className="relative h-full w-full overflow-auto rounded-lg border border-gray-200 bg-gray-50"
                style={{ touchAction: "pan-x pan-y" }}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                <Stage
                    width={DESIGN_WIDTH * scale}
                    height={DESIGN_HEIGHT * scale}
                    scaleX={scale}
                    scaleY={scale}
                    onMouseDown={handleStageMouseDown}
                    onMouseMove={handleStageMouseMove}
                    onMouseUp={endPan}
                    onMouseLeave={endPan}
                    onTouchStart={handleStageTouchStart}
                    onTouchMove={handleStageTouchMove}
                    onTouchEnd={endPan}
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
                                points={bubbles.flatMap((bubble) => {
                                    const point = toDesignSpace({x: bubble.x, y: bubble.y});
                                    return [point.x, point.y];
                                })}
                                stroke="#94a3b8"
                                strokeWidth={4}
                                dash={[14, 10]}
                                lineCap="round"
                                lineJoin="round"
                                opacity={0.7}
                            />
                        )}
                    </Layer>
                    <Layer>
                        {bubbles.map((bubble) => (
                            <Bubble
                                key={bubble.id}
                                x={bubble.x}
                                y={bubble.y}
                                status={bubble.status}
                                icon={bubble.icon ?? undefined}
                                draggable={editable}
                                pulseKey={focusPulse?.bubbleId === bubble.id ? focusPulse.key : undefined}
                                onClick={unavailableReasonFor(bubble) ? undefined : () => handleBubbleClick(bubble)}
                                onHoverChange={(hovered) => setHoveredBubbleId(hovered ? bubble.id : null)}
                                onDragStart={() => setIconPickerBubbleId(null)}
                                onDragEnd={(pos) => handleBubbleDragEnd(bubble.id, pos)}
                            />
                        ))}
                    </Layer>
                </Stage>
                {hoveredUnavailableBubble && hoveredUnavailableReason && (
                    <div
                        role="tooltip"
                        className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[calc(100%+40px)] whitespace-nowrap rounded-md bg-gray-800 px-2 py-1 text-xs text-white shadow-lg"
                        style={{
                            left: toDesignSpace({ x: hoveredUnavailableBubble.x, y: hoveredUnavailableBubble.y }).x * scale,
                            top: toDesignSpace({ x: hoveredUnavailableBubble.x, y: hoveredUnavailableBubble.y }).y * scale,
                        }}
                    >
                        {hoveredUnavailableReason}
                    </div>
                )}
                {iconPickerBubble && (
                    <IconPickerPopover
                        key={iconPickerBubble.id}
                        x={toDesignSpace({ x: iconPickerBubble.x, y: iconPickerBubble.y }).x * scale}
                        y={toDesignSpace({ x: iconPickerBubble.x, y: iconPickerBubble.y }).y * scale}
                        currentIcon={iconPickerBubble.icon ?? undefined}
                        currentStatus={iconPickerBubble.status}
                        onSelect={(icon) => handleIconSelect(iconPickerBubble.id, icon)}
                        onStatusSelect={(status) => handleStatusSelect(iconPickerBubble.id, status)}
                        onDelete={() => handleDelete(iconPickerBubble.id)}
                        onClose={() => setIconPickerBubbleId(null)}
                    />
                )}
            </div>
            <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1 rounded-lg bg-white/90 p-1 shadow-md backdrop-blur">
                <button
                    type="button"
                    onClick={() => handleZoomButton(1 / ZOOM_STEP)}
                    aria-label="Zoom out"
                    className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-gray-100"
                >
                    &minus;
                </button>
                <span className="pointer-events-auto min-w-[3rem] text-center text-xs text-gray-500">
                    {Math.round(zoom * 100)}%
                </span>
                <button
                    type="button"
                    onClick={() => handleZoomButton(ZOOM_STEP)}
                    aria-label="Zoom in"
                    className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-gray-100"
                >
                    +
                </button>
                <button
                    type="button"
                    onClick={handleZoomReset}
                    aria-label="Reset zoom"
                    className="pointer-events-auto ml-1 rounded px-2 py-1 text-[10px] font-medium uppercase text-gray-400 hover:bg-gray-100"
                >
                    Reset
                </button>
            </div>
        </div>
    );
};
