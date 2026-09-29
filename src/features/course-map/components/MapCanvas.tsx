import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage } from "react-konva";
import useImage from "use-image";
import {DESIGN_HEIGHT, DESIGN_WIDTH, type Activity, type BubbleData, type MapCanvasProps} from "../types/course-props.types.ts";
import {clampRelative, toRelativeSpace} from "../coordinates.ts";
import Bubble from "./Bubble.tsx";

export const MapCanvas = ({ backgroundUrl, bubbles, editable, onBubblesChange, onBubbleClick }: MapCanvasProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const [background] = useImage(backgroundUrl);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const observer = new ResizeObserver((entries) => {
            const { width } = entries[0].contentRect;
            setScale(width / DESIGN_WIDTH);
        });

        observer.observe(container);
        return () => observer.disconnect();
    }, []);

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
        const design = { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
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
        <div
            ref={containerRef}
            className="w-full overflow-y-auto"
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
    );
};
