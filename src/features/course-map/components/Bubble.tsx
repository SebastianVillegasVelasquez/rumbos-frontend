import {type BubbleProps, STATUS_COLORS} from "../types/course-props.types.ts";
import {Circle, Group, Image as KonvaImage, Text} from "react-konva";
import Konva from "konva";
import {useEffect, useRef, useState} from "react";
import useImage from "use-image";
import {clampRelative, toDesignSpace, toRelativeSpace} from "../coordinates.ts";
import {ICON_DATA_URIS} from "../icons.ts";

const HOVER_SCALE = 1.12;
const PULSE_SCALE = 1.3;
const ICON_SIZE = 30;

const Bubble = ({x, y, status, icon, draggable, onClick, onDragEnd, onDragStart}: BubbleProps) => {
    const {x: posX, y: posY} = toDesignSpace({x, y});
    const [iconImage] = useImage(icon ? (ICON_DATA_URIS[icon] ?? "") : "");

    const groupRef = useRef<Konva.Group>(null);
    const ringRef = useRef<Konva.Circle>(null);
    const [isHovered, setIsHovered] = useState(false);
    const [isPulsing, setIsPulsing] = useState(false);
    const prevStatusRef = useRef(status);

    // Cosmetic-only feedback: briefly pulse when a bubble transitions to
    // "complete". Driven purely by the existing status field - no new data.
    useEffect(() => {
        if (prevStatusRef.current !== "complete" && status === "complete") {
            setIsPulsing(true);
        }
        prevStatusRef.current = status;
    }, [status]);

    useEffect(() => {
        if (!isHovered) return;
        const group = groupRef.current;
        if (!group) return;
        const tween = new Konva.Tween({
            node: group,
            scaleX: HOVER_SCALE,
            scaleY: HOVER_SCALE,
            duration: 0.12,
            easing: Konva.Easings.EaseOut,
        });
        tween.play();
        return () => tween.destroy();
    }, [isHovered]);

    useEffect(() => {
        if (!isPulsing) return;
        const group = groupRef.current;
        const ring = ringRef.current;
        if (!group || !ring) return;

        ring.radius(30);
        ring.opacity(0.8);
        const ringTween = new Konva.Tween({
            node: ring,
            radius: 55,
            opacity: 0,
            duration: 0.5,
            easing: Konva.Easings.EaseOut,
            onFinish: () => setIsPulsing(false),
        });
        ringTween.play();

        const bounceOut = new Konva.Tween({
            node: group,
            scaleX: PULSE_SCALE,
            scaleY: PULSE_SCALE,
            duration: 0.15,
            easing: Konva.Easings.EaseOut,
            onFinish: () => {
                const bounceBack = new Konva.Tween({
                    node: group,
                    scaleX: isHovered ? HOVER_SCALE : 1,
                    scaleY: isHovered ? HOVER_SCALE : 1,
                    duration: 0.25,
                    easing: Konva.Easings.EaseOut,
                });
                bounceBack.play();
            },
        });
        bounceOut.play();

        return () => {
            ringTween.destroy();
            bounceOut.destroy();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPulsing]);

    const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
        const relative = toRelativeSpace({x: e.target.x(), y: e.target.y()});
        onDragEnd?.(clampRelative(relative));
    };

    const handleMouseEnter = (e: Konva.KonvaEventObject<MouseEvent>) => {
        setIsHovered(true);
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = draggable || onClick ? "pointer" : "default";
    };

    const handleMouseLeave = (e: Konva.KonvaEventObject<MouseEvent>) => {
        setIsHovered(false);
        const group = groupRef.current;
        if (group && !isPulsing) {
            new Konva.Tween({
                node: group,
                scaleX: 1,
                scaleY: 1,
                duration: 0.12,
                easing: Konva.Easings.EaseOut,
            }).play();
        }
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = "default";
    };

    return (
        <Group
            ref={groupRef}
            x={posX}
            y={posY}
            draggable={draggable}
            onClick={onClick}
            onTap={onClick}
            onDragStart={onDragStart}
            onDragEnd={handleDragEnd}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {isPulsing && (
                <Circle ref={ringRef} radius={30} stroke={STATUS_COLORS.complete} strokeWidth={4} listening={false}/>
            )}
            <Circle
                radius={30}
                fill={STATUS_COLORS[status]}
                stroke="white"
                strokeWidth={3}
                shadowColor={STATUS_COLORS[status]}
                shadowBlur={isHovered ? 18 : 0}
                shadowOpacity={0.6}
            />
            {iconImage ? (
                <KonvaImage
                    image={iconImage}
                    width={ICON_SIZE}
                    height={ICON_SIZE}
                    offsetX={ICON_SIZE / 2}
                    offsetY={ICON_SIZE / 2}
                    listening={false}
                />
            ) : (
                <Text
                    text="?"
                    fontSize={24}
                    fill="white"
                    width={60}
                    height={60}
                    offsetX={30}
                    offsetY={30}
                    align="center"
                    verticalAlign="middle"
                    listening={false}
                />
            )}
        </Group>
    );
};
export default Bubble
