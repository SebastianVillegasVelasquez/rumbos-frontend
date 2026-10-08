import { useEffect, useRef } from "react";
import { Layer } from "react-konva";
import Konva from "konva";
import type { AmbientKind } from "../features/course-map/data/types.ts";
import type { DesignSize } from "../features/course-map/coordinates.ts";
import { createPool, particleOpacity, stepPool, type Particle } from "./math/particlePool.ts";
import { createRng, rngRange } from "./math/rng.ts";
import { sharedTicker } from "../features/course-map/viewport/ticker.ts";
import { AMBIENT } from "./constants.ts";
import type { QualityTier } from "./quality.ts";

interface KindStyle {
    color: string;
    sizeRange: [number, number];
    lifeMsRange: [number, number];
    spawn: (rng: () => number, size: DesignSize) => { x: number; y: number; vx: number; vy: number };
}

const KIND_STYLE: Record<Exclude<AmbientKind, "none">, KindStyle> = {
    fireflies: {
        color: "#ffd866",
        sizeRange: [2, 4],
        lifeMsRange: [4000, 8000],
        spawn: (rng, size) => ({
            x: rngRange(rng, 0, size.width),
            y: rngRange(rng, 0, size.height),
            vx: rngRange(rng, -6, 6),
            vy: rngRange(rng, -6, 6),
        }),
    },
    snow: {
        color: "#ffffff",
        sizeRange: [2, 5],
        lifeMsRange: [6000, 11000],
        spawn: (rng, size) => ({
            x: rngRange(rng, 0, size.width),
            y: -10,
            vx: rngRange(rng, -8, 8),
            vy: rngRange(rng, 24, 48),
        }),
    },
    leaves: {
        color: "#d9a441",
        sizeRange: [4, 7],
        lifeMsRange: [5000, 9000],
        spawn: (rng, size) => ({
            x: rngRange(rng, 0, size.width),
            y: -10,
            vx: rngRange(rng, -14, 14),
            vy: rngRange(rng, 18, 34),
        }),
    },
    clouds: {
        color: "rgba(255,255,255,0.5)",
        sizeRange: [40, 80],
        lifeMsRange: [14000, 22000],
        spawn: (rng, size) => ({
            x: -80,
            y: rngRange(rng, 0, size.height * 0.4),
            vx: rngRange(rng, 8, 16),
            vy: 0,
        }),
    },
    sparkles: {
        color: "#7de3a8",
        sizeRange: [1.5, 3],
        lifeMsRange: [1200, 2200],
        spawn: (rng, size) => ({
            x: rngRange(rng, 0, size.width),
            y: rngRange(rng, 0, size.height),
            vx: 0,
            vy: 0,
        }),
    },
};

interface AmbientLayerProps {
    kind: AmbientKind;
    intensity: number;
    designSize: DesignSize;
    tier: QualityTier;
}

// A pooled, content-space weather layer (drifts/pans with the map rather
// than sitting fixed on screen) between the background and the bubbles.
// Driven entirely off the shared ticker, with Konva.Circle nodes created
// once and mutated imperatively every tick - never React state per frame.
export const AmbientLayer = ({ kind, intensity, designSize, tier }: AmbientLayerProps) => {
    const layerRef = useRef<Konva.Layer>(null);

    const cap = AMBIENT.capByTier[tier];
    const capacity = kind === "none" ? 0 : Math.min(Math.round(AMBIENT.baseCountByKind[kind] * intensity), cap);

    useEffect(() => {
        const layer = layerRef.current;
        const stage = layer?.getStage();
        if (!layer || !stage || kind === "none" || capacity === 0) return;

        const style = KIND_STYLE[kind];
        const rng = createRng(1);
        const pool: Particle[] = createPool(capacity);
        const nodes: Konva.Circle[] = pool.map(() => {
            const circle = new Konva.Circle({ radius: 1, fill: style.color, visible: false, listening: false });
            layer.add(circle);
            return circle;
        });

        const unsubscribe = sharedTicker.subscribe(stage, (frame) => {
            stepPool(pool, Math.min(frame.timeDiff, 48), capacity, () => {
                const spawn = style.spawn(rng, designSize);
                return {
                    ...spawn,
                    lifeMs: rngRange(rng, style.lifeMsRange[0], style.lifeMsRange[1]),
                    size: rngRange(rng, style.sizeRange[0], style.sizeRange[1]),
                    seed: rng(),
                };
            });
            for (let i = 0; i < pool.length; i++) {
                const particle = pool[i];
                const node = nodes[i];
                // Wrap particles that drift off the content bounds (clouds
                // loop around; anything that falls past the bottom retires).
                if (particle.active && particle.x > designSize.width + 100) particle.x = -100;
                if (particle.active && particle.y > designSize.height + 100) particle.active = false;
                node.visible(particle.active);
                if (!particle.active) continue;
                node.x(particle.x);
                node.y(particle.y);
                node.radius(particle.size);
                node.opacity(particleOpacity(particle));
            }
            layer.batchDraw();
        });

        return () => {
            unsubscribe();
            nodes.forEach((node) => node.destroy());
        };
    }, [kind, capacity, designSize]);

    if (kind === "none" || capacity === 0) return null;
    return <Layer ref={layerRef} listening={false} />;
};
