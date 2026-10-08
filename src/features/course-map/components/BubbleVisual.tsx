import { useEffect, useRef, useState } from "react";
import { Circle, Group, Image as KonvaImage, Line, RegularPolygon, Rect, Text } from "react-konva";
import Konva from "konva";
import useImage from "use-image";
import type { BubbleVisualProps } from "../types/course-props.types.ts";
import { clampRelative, toDesignSpace, toRelativeSpace } from "../coordinates.ts";
import { ICON_DATA_URIS_DARK, ICON_DATA_URIS_LIGHT, iconDataUri } from "../icons.ts";
import { contrastingTextColor } from "../color.ts";
import { resolveImageUrl } from "../data/assets.ts";
import type { ImageSkin, ImageSkinState, SkinPalette } from "../data/types.ts";
import { sharedTicker } from "../viewport/ticker.ts";
import { useAnimationQuality } from "../../../fx/quality.ts";
import { IDLE } from "../../../fx/constants.ts";

const HOVER_SCALE = 1.12;
const PULSE_SCALE = 1.3;

const MUTED_FILL = "#8a94a6";

const PALETTE_STATE: Record<BubbleVisualProps["visualState"], keyof SkinPalette> = {
    locked: "locked",
    available: "available",
    next: "available",
    inProgress: "inProgress",
    complete: "complete",
    teaser: "locked",
    missing: "locked",
    unknown: "locked",
};

const IMAGE_STATE: Record<BubbleVisualProps["visualState"], ImageSkinState> = {
    locked: "locked",
    available: "available",
    next: "next",
    inProgress: "inProgress",
    complete: "complete",
    teaser: "locked",
    missing: "locked",
    unknown: "locked",
};

const isMuted = (state: BubbleVisualProps["visualState"]) =>
    state === "teaser" || state === "missing" || state === "unknown";

const ProceduralShape = ({
    shape,
    size,
    fill,
    isHovered,
}: {
    shape: "circle" | "hexagon" | "badge" | "pin";
    size: number;
    fill: string;
    isHovered: boolean;
}) => {
    const radius = size / 2;
    const shadowProps = { shadowColor: "black", shadowBlur: isHovered ? 10 : 4, shadowOpacity: 0.25, shadowOffsetY: 2 };

    switch (shape) {
        case "hexagon":
            return <RegularPolygon sides={6} radius={radius} fill={fill} stroke="white" strokeWidth={3} {...shadowProps} />;
        case "badge":
            return (
                <Rect
                    x={-radius}
                    y={-radius}
                    width={size}
                    height={size}
                    cornerRadius={size * 0.28}
                    fill={fill}
                    stroke="white"
                    strokeWidth={3}
                    {...shadowProps}
                />
            );
        case "pin":
            return (
                <Group>
                    <Line
                        points={[0, radius * 1.6, -radius * 0.55, radius * 0.25, radius * 0.55, radius * 0.25]}
                        closed
                        fill={fill}
                        {...shadowProps}
                    />
                    <Circle y={-radius * 0.1} radius={radius * 0.85} fill={fill} stroke="white" strokeWidth={3} />
                </Group>
            );
        case "circle":
        default:
            return <Circle radius={radius} fill={fill} stroke="white" strokeWidth={3} {...shadowProps} />;
    }
};

// Renders either a ProceduralSkin (shape + palette + icon + label + idle/
// hover/pulse effects, all code-generated) or an ImageSkin (per-state
// uploaded art with a documented fallback chain). Used identically by the
// canvas, the skin gallery, and the skin studio preview.
const BubbleVisual = ({
    x,
    y,
    designSize,
    visualState,
    skin,
    icon,
    label,
    draggable,
    onClick,
    onHoverChange,
    onDragStart,
    onDragEnd,
    pulseKey,
}: BubbleVisualProps) => {
    const { x: posX, y: posY } = toDesignSpace({ x, y }, designSize);
    const muted = isMuted(visualState);

    const groupRef = useRef<Konva.Group>(null);
    const ringRef = useRef<Konva.Circle>(null);
    const [idlePhase] = useState(() => Math.random() * Math.PI * 2);
    const [isHovered, setIsHovered] = useState(false);
    const [isPulsing, setIsPulsing] = useState(false);
    const prevVisualStateRef = useRef(visualState);
    const prevPulseKeyRef = useRef(pulseKey);
    const isActionable = !muted && (visualState === "available" || visualState === "next" || visualState === "inProgress");
    const { tier } = useAnimationQuality();
    const animationsOff = tier === "off";
    const tweenDuration = (seconds: number) => (animationsOff ? 0 : seconds);

    // Cosmetic-only feedback: briefly pulse when a bubble transitions to
    // "complete". Driven purely by the resolved visual state - no new data,
    // and only on an observed live change (never on first mount, since the
    // ref starts equal to the initial visualState).
    useEffect(() => {
        if (prevVisualStateRef.current !== "complete" && visualState === "complete" && !animationsOff) setIsPulsing(true);
        prevVisualStateRef.current = visualState;
    }, [visualState, animationsOff]);

    useEffect(() => {
        if (pulseKey !== undefined && pulseKey !== prevPulseKeyRef.current && !animationsOff) setIsPulsing(true);
        prevPulseKeyRef.current = pulseKey;
    }, [pulseKey, animationsOff]);

    const idleEffect =
        animationsOff || tier === "low"
            ? skin.kind === "procedural" && skin.effects.idle !== "none"
                ? "breathe"
                : "none"
            : skin.kind === "procedural"
              ? skin.effects.idle
              : skin.effects.idle === "breathe"
                ? "breathe"
                : "none";

    // Subtle idle loop (gentle scale/offset breathing) on bubbles the
    // student can still act on, piggybacking on the fx engine's single
    // shared ticker (viewport/ticker.ts) instead of a per-bubble timer.
    useEffect(() => {
        const group = groupRef.current;
        const stage = group?.getStage();
        if (!isActionable || isHovered || isPulsing || !group || !stage || idleEffect === "none" || animationsOff) {
            if (group) {
                group.scaleX(1);
                group.scaleY(1);
                group.offsetY(0);
            }
            return;
        }

        const params = idleEffect === "float" ? IDLE.float : idleEffect === "pulse" ? IDLE.pulse : IDLE.breathe;
        const unsubscribe = sharedTicker.subscribe(stage, (frame) => {
            const wave = (Math.sin((frame.time / params.periodMs) * (2 * Math.PI) + idlePhase) + 1) / 2; // 0..1
            if (idleEffect === "float") {
                group.offsetY(-wave * params.amplitude);
            } else {
                const idleScale = 1 + wave * params.amplitude;
                group.scaleX(idleScale);
                group.scaleY(idleScale);
            }
        });

        return () => {
            unsubscribe();
            group.scaleX(1);
            group.scaleY(1);
            group.offsetY(0);
        };
    }, [isActionable, isHovered, isPulsing, idlePhase, idleEffect, animationsOff]);

    useEffect(() => {
        if (!isHovered) return;
        const group = groupRef.current;
        if (!group) return;
        const tween = new Konva.Tween({
            node: group,
            scaleX: HOVER_SCALE,
            scaleY: HOVER_SCALE,
            duration: tweenDuration(0.12),
            easing: Konva.Easings.EaseOut,
        });
        tween.play();
        return () => tween.destroy();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isHovered]);

    const glowColor = skin.kind === "procedural" ? skin.palette[PALETTE_STATE[visualState]].glow : "#2fbf71";

    useEffect(() => {
        if (!isPulsing) return;
        const group = groupRef.current;
        const ring = ringRef.current;
        if (!group || !ring) return;

        const baseRadius = skin.kind === "procedural" ? skin.size / 2 : skin.size / 2;
        ring.radius(baseRadius);
        ring.opacity(0.8);
        const ringTween = new Konva.Tween({
            node: ring,
            radius: baseRadius * 1.8,
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
                new Konva.Tween({
                    node: group,
                    scaleX: isHovered ? HOVER_SCALE : 1,
                    scaleY: isHovered ? HOVER_SCALE : 1,
                    duration: 0.25,
                    easing: Konva.Easings.EaseOut,
                }).play();
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
        const relative = toRelativeSpace({ x: e.target.x(), y: e.target.y() }, designSize);
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
            new Konva.Tween({ node: group, scaleX: 1, scaleY: 1, duration: tweenDuration(0.12), easing: Konva.Easings.EaseOut }).play();
        }
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = "default";
    };

    const showLabel = label && (skin.label.mode === "always" || (skin.label.mode === "hover" && isHovered));

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
            opacity={muted ? 0.55 : 1}
        >
            {visualState === "missing" && (
                <Circle radius={(skin.size / 2) * 1.25} stroke="#c23b3b" strokeWidth={2.5} dash={[6, 5]} listening={false} />
            )}
            {isPulsing && <Circle ref={ringRef} radius={skin.size / 2} stroke={glowColor} strokeWidth={4} listening={false} />}
            {skin.kind === "procedural" ? (
                <ProceduralBody skin={skin} visualState={visualState} icon={icon} isHovered={isHovered} muted={muted} />
            ) : (
                <ImageBody skin={skin} visualState={visualState} isHovered={isHovered} />
            )}
            {showLabel && (
                <Group y={skin.size / 2 + 10} listening={false}>
                    <Rect
                        x={-label!.length * 3.4 - 8}
                        width={label!.length * 6.8 + 16}
                        height={22}
                        offsetY={11}
                        cornerRadius={11}
                        fill="rgba(30,42,74,0.9)"
                    />
                    <Text text={label} fontSize={12} fontStyle="600" fill="white" width={label!.length * 6.8 + 16} offsetX={label!.length * 3.4} offsetY={6} align="center" />
                </Group>
            )}
        </Group>
    );
};

const ProceduralBody = ({
    skin,
    visualState,
    icon,
    isHovered,
    muted,
}: {
    skin: Extract<BubbleVisualProps["skin"], { kind: "procedural" }>;
    visualState: BubbleVisualProps["visualState"];
    icon: BubbleVisualProps["icon"];
    isHovered: boolean;
    muted: boolean;
}) => {
    const paletteEntry = skin.palette[PALETTE_STATE[visualState]];
    const fill = muted ? MUTED_FILL : paletteEntry.fill;
    const iconColor = skin.icon.color === "auto" ? contrastingTextColor(fill) : skin.icon.color;
    const isDarkIcon = iconColor !== "white" && iconColor.toLowerCase() !== "#ffffff";
    const resolvedIcon = skin.icon.mode === "none" ? undefined : skin.icon.mode === "preset" ? skin.icon.preset ?? undefined : icon;
    const customUri = resolvedIcon ? iconDataUri(resolvedIcon, iconColor) : null;
    const fallbackUri = resolvedIcon ? (isDarkIcon ? ICON_DATA_URIS_DARK : ICON_DATA_URIS_LIGHT)[resolvedIcon] : undefined;
    const [iconImage] = useImage(customUri ?? fallbackUri ?? "");
    const iconSize = skin.size * 0.47;

    return (
        <>
            <Circle
                radius={skin.size / 2 + 3}
                fillRadialGradientStartPoint={{ x: -skin.size * 0.13, y: -skin.size * 0.16 }}
                fillRadialGradientStartRadius={0}
                fillRadialGradientEndPoint={{ x: 0, y: 0 }}
                fillRadialGradientEndRadius={skin.size * 0.6}
                fillRadialGradientColorStops={[0, "rgba(255,255,255,0.35)", 1, "rgba(255,255,255,0)"]}
                listening={false}
            />
            <ProceduralShape shape={skin.shape} size={skin.size} fill={fill} isHovered={isHovered} />
            {resolvedIcon && iconImage ? (
                <KonvaImage image={iconImage} width={iconSize} height={iconSize} offsetX={iconSize / 2} offsetY={iconSize / 2} listening={false} />
            ) : resolvedIcon ? (
                <Text
                    text="?"
                    fontSize={iconSize * 0.8}
                    fill={iconColor}
                    width={iconSize * 2}
                    height={iconSize * 2}
                    offsetX={iconSize}
                    offsetY={iconSize}
                    align="center"
                    verticalAlign="middle"
                    listening={false}
                />
            ) : null}
            {visualState === "complete" && !muted && (
                <Group x={skin.size * 0.32} y={-skin.size * 0.32} listening={false}>
                    <Circle radius={10} fill="white" stroke={skin.palette.complete.fill} strokeWidth={2} />
                    <Line points={[-4, 0, -1, 3.5, 5, -4]} stroke={skin.palette.complete.fill} strokeWidth={2.4} lineCap="round" lineJoin="round" />
                </Group>
            )}
            {visualState === "locked" && muted === false && skin.effects.ring && (
                <Circle radius={skin.size / 2 + 5} stroke={paletteEntry.accent} strokeWidth={1.5} opacity={0.5} listening={false} />
            )}
        </>
    );
};

const ImageBody = ({
    skin,
    visualState,
    isHovered,
}: {
    skin: ImageSkin;
    visualState: BubbleVisualProps["visualState"];
    isHovered: boolean;
}) => {
    const stateKey = IMAGE_STATE[visualState];
    const hoverAssetId = isHovered ? skin.states.hover : null;
    const assetId = hoverAssetId ?? skin.states[stateKey] ?? skin.states.available;
    const [image] = useImage(assetId ? resolveImageUrl(`/assets/${assetId}`) : "");
    const desaturate = stateKey === "locked" && !skin.states.locked;
    const size = skin.size;

    return (
        <>
            {image && (
                <KonvaImage
                    image={image}
                    width={size}
                    height={size}
                    offsetX={size / 2}
                    offsetY={skin.anchor === "bottom" ? size : size / 2}
                    opacity={desaturate ? 0.55 : 1}
                    listening={false}
                />
            )}
            {stateKey === "locked" && (
                <Group x={size * 0.28} y={size * (skin.anchor === "bottom" ? -0.86 : -0.36)} listening={false}>
                    <Circle radius={11} fill="#5b6478" stroke="white" strokeWidth={2} />
                    <Rect x={-5} y={-1} width={10} height={8} cornerRadius={1.5} fill="white" />
                    <Line points={[-3.5, -1, -3.5, -4, 0, -6, 3.5, -4, 3.5, -1]} stroke="white" strokeWidth={1.6} lineCap="round" />
                </Group>
            )}
            {stateKey === "complete" && (
                <Group x={size * 0.28} y={size * (skin.anchor === "bottom" ? -0.86 : -0.36)} listening={false}>
                    <Circle radius={11} fill="white" stroke="#178049" strokeWidth={2} />
                    <Line points={[-4, 0, -1, 3.5, 5, -4]} stroke="#178049" strokeWidth={2.2} lineCap="round" lineJoin="round" />
                </Group>
            )}
        </>
    );
};

export default BubbleVisual;
