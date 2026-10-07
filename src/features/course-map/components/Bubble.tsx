import {type BubbleProps, STATUS_COLORS, STATUS_GLOW_COLORS, STATUS_ICON_IS_DARK} from "../types/course-props.types.ts";
import {Circle, Group, Image as KonvaImage, Line, Text} from "react-konva";
import Konva from "konva";
import {useEffect, useRef, useState} from "react";
import useImage from "use-image";
import {clampRelative, toDesignSpace, toRelativeSpace} from "../coordinates.ts";
import {ICON_DATA_URIS_DARK, ICON_DATA_URIS_LIGHT} from "../icons.ts";

const HOVER_SCALE = 1.12;
const PULSE_SCALE = 1.3;
const ICON_SIZE = 30;

const Bubble = ({x, y, status, icon, draggable, onClick, onHoverChange, onDragEnd, onDragStart, pulseKey}: BubbleProps) => {
    const {x: posX, y: posY} = toDesignSpace({x, y});
    const isDarkIcon = STATUS_ICON_IS_DARK[status];
    const iconUris = isDarkIcon ? ICON_DATA_URIS_DARK : ICON_DATA_URIS_LIGHT;
    const [iconImage] = useImage(icon ? (iconUris[icon] ?? "") : "");

    const groupRef = useRef<Konva.Group>(null);
    const ringRef = useRef<Konva.Circle>(null);
    const circleRef = useRef<Konva.Circle>(null);
    const idleAnimRef = useRef<Konva.Animation | null>(null);
    const [idlePhase] = useState(() => Math.random() * Math.PI * 2);
    const [isHovered, setIsHovered] = useState(false);
    const [isPulsing, setIsPulsing] = useState(false);
    const prevStatusRef = useRef(status);
    const prevPulseKeyRef = useRef(pulseKey);
    const isActionable = status === "no_complete" || status === "in_progress";

    // Cosmetic-only feedback: briefly pulse when a bubble transitions to
    // "complete". Driven purely by the existing status field - no new data.
    useEffect(() => {
        if (prevStatusRef.current !== "complete" && status === "complete") {
            setIsPulsing(true);
        }
        prevStatusRef.current = status;
    }, [status]);

    // Same pulse, externally triggered (e.g. picked from the activities
    // overview panel) instead of by a status change.
    useEffect(() => {
        if (pulseKey !== undefined && pulseKey !== prevPulseKeyRef.current) {
            setIsPulsing(true);
        }
        prevPulseKeyRef.current = pulseKey;
    }, [pulseKey]);

    // Subtle idle loop (gentle scale + glow breathing) on bubbles the
    // student can still act on, to draw the eye without being distracting.
    // Paused during hover/pulse so it never fights those tweens, and it's
    // a single Konva.Animation per actionable bubble - Konva batches all
    // active animations into one shared RAF loop, so this stays cheap even
    // with several bubbles animating at once.
    useEffect(() => {
        const group = groupRef.current;
        const circle = circleRef.current;
        if (!isActionable || isHovered || isPulsing || !group || !circle) {
            idleAnimRef.current?.stop();
            idleAnimRef.current = null;
            return;
        }

        const anim = new Konva.Animation((frame) => {
            if (!frame) return;
            const wave = (Math.sin(frame.time / 650 + idlePhase) + 1) / 2; // 0..1
            const idleScale = 1 + wave * 0.035;
            group.scaleX(idleScale);
            group.scaleY(idleScale);
            circle.shadowBlur(4 + wave * 10);
            circle.shadowOpacity(0.35 + wave * 0.25);
        }, group.getLayer());
        anim.start();
        idleAnimRef.current = anim;

        return () => {
            anim.stop();
            group.scaleX(1);
            group.scaleY(1);
            circle.shadowBlur(0);
        };
    }, [isActionable, isHovered, isPulsing, idlePhase]);

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
        onHoverChange?.(true);
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = draggable || onClick ? "pointer" : "default";
    };

    const handleMouseLeave = (e: Konva.KonvaEventObject<MouseEvent>) => {
        setIsHovered(false);
        onHoverChange?.(false);
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
                <Circle ref={ringRef} radius={30} stroke={STATUS_GLOW_COLORS[status]} strokeWidth={4} listening={false}/>
            )}
            <Circle
                radius={33}
                fillRadialGradientStartPoint={{ x: -8, y: -10 }}
                fillRadialGradientStartRadius={0}
                fillRadialGradientEndPoint={{ x: 0, y: 0 }}
                fillRadialGradientEndRadius={38}
                fillRadialGradientColorStops={[0, "rgba(255,255,255,0.35)", 1, "rgba(255,255,255,0)"]}
                listening={false}
            />
            <Circle
                ref={circleRef}
                radius={30}
                fill={STATUS_COLORS[status]}
                stroke="white"
                strokeWidth={3}
                shadowColor={STATUS_GLOW_COLORS[status]}
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
                    fill={isDarkIcon ? "#1E2A4A" : "white"}
                    width={60}
                    height={60}
                    offsetX={30}
                    offsetY={30}
                    align="center"
                    verticalAlign="middle"
                    listening={false}
                />
            )}
            {status === "complete" && (
                <Group x={20} y={-20} listening={false}>
                    <Circle radius={10} fill="white" stroke={STATUS_COLORS.complete} strokeWidth={2}/>
                    <Line
                        points={[-4, 0, -1, 3.5, 5, -4]}
                        stroke={STATUS_COLORS.complete}
                        strokeWidth={2.4}
                        lineCap="round"
                        lineJoin="round"
                    />
                </Group>
            )}
        </Group>
    );
};
export default Bubble
