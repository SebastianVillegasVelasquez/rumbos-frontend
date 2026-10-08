import { Stage, Layer } from "react-konva";
import BubbleVisual from "./BubbleVisual.tsx";
import type { SkinConfig } from "../data/types.ts";
import type { VisualState } from "../visualState.ts";
import type { DesignSize } from "../coordinates.ts";

const STATES: VisualState[] = ["locked", "available", "inProgress", "complete"];
const SLOT = 64;

// Renders a skin's four palette states side by side - used identically by
// the skin gallery, the skin studio's live preview, and (via BubbleVisual
// itself) the real canvas, so what you design here is what the map shows.
export const SkinPreviewRow = ({ skin, size = SLOT }: { skin: SkinConfig; size?: number }) => {
    const designSize: DesignSize = { width: size * STATES.length, height: size };
    return (
        <Stage width={designSize.width} height={designSize.height}>
            <Layer>
                {STATES.map((state, index) => (
                    <BubbleVisual
                        key={state}
                        x={(index + 0.5) / STATES.length}
                        y={0.5}
                        designSize={designSize}
                        visualState={state}
                        skin={skin}
                        icon="star"
                    />
                ))}
            </Layer>
        </Stage>
    );
};
