import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Line } from "react-konva";
import useImage from "use-image";
import {DESIGN_HEIGHT, DESIGN_WIDTH, type Activity, type BubbleData, type MapCanvasProps} from "../types/course-props.types.ts";
import {clampRelative, toDesignSpace, toRelativeSpace} from "../coordinates.ts";
import Bubble from "./Bubble.tsx";

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 1.15;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

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

export const MapCanvas = ({ backgroundUrl, bubbles, editable, onBubblesChange, onBubbleClick }: MapCanvasProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [fitScale, setFitScale] = useState(1);
    const [zoom, setZoom] = useState(1);
    const [background] = useImage(backgroundUrl);

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

            const prevScale = fitScaleRef.current * prevZoom;
            const content = getContentPoint(container, prevScale, e.clientX, e.clientY);
            setZoom(nextZoom);
            requestAnimationFrame(() => {
                const nextScale = fitScaleRef.current * nextZoom;
                scrollToContentPoint(container, nextScale, content, e.clientX, e.clientY);
            });
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
        const prevZoom = zoomRef.current;
        const nextZoom = clamp(prevZoom * factor, MIN_ZOOM, MAX_ZOOM);
        if (nextZoom === prevZoom) return;

        const prevScale = fitScaleRef.current * prevZoom;
        const content = getContentPoint(container, prevScale, clientX, clientY);
        setZoom(nextZoom);
        requestAnimationFrame(() => {
            const nextScale = fitScaleRef.current * nextZoom;
            scrollToContentPoint(container, nextScale, content, clientX, clientY);
        });
    };

    const handleZoomReset = () => {
        setZoom(1);
        requestAnimationFrame(() => {
            const container = containerRef.current;
            if (!container) return;
            container.scrollLeft = 0;
            container.scrollTop = 0;
        });
    };

    const handleBubbleDragEnd = (bubbleId: number, pos: { x: number; y: number }) => {
        onBubblesChange?.(
            bubbles.map((bubble) => (bubble.bubbleId === bubbleId ? { ...bubble, x: pos.x, y: pos.y } : bubble))
        );
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        if (!editable) return;
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        if (!editable) return;
        e.preventDefault();
        const raw = e.dataTransfer.getData("application/json");
        if (!raw) return;

        const activity = JSON.parse(raw) as Activity;
        const container = containerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const design = {
            x: (e.clientX - rect.left + container.scrollLeft) / scale,
            y: (e.clientY - rect.top + container.scrollTop) / scale,
        };
        const relative = clampRelative(toRelativeSpace(design));

        const newBubble: BubbleData = {
            bubbleId: Date.now(),
            activityId: activity.id,
            x: relative.x,
            y: relative.y,
            status: "no_complete",
        };

        onBubblesChange?.([...bubbles, newBubble]);
    };

    return (
        <div className="relative h-full w-full">
            <div
                ref={containerRef}
                className="h-full w-full overflow-auto rounded-lg border border-gray-200 bg-gray-50"
                style={{ touchAction: "pan-x pan-y" }}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                <Stage
                    width={DESIGN_WIDTH * scale}
                    height={DESIGN_HEIGHT * scale}
                    scaleX={scale}
                    scaleY={scale}
                >
                    <Layer>
                        <KonvaImage image={background} width={DESIGN_WIDTH} height={DESIGN_HEIGHT} />
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
                                key={bubble.bubbleId}
                                x={bubble.x}
                                y={bubble.y}
                                status={bubble.status}
                                draggable={editable}
                                onClick={() => !editable && onBubbleClick?.(bubble)}
                                onDragEnd={(pos) => handleBubbleDragEnd(bubble.bubbleId, pos)}
                            />
                        ))}
                    </Layer>
                </Stage>
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
