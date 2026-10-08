import type { DesignSize } from "../coordinates.ts";
import type {
    Activity,
    Availability,
    Bubble,
    BubbleUpdate,
    MapFit,
    MapInitialView,
    MapMode,
    MapSettings,
    Skin,
    SkinRule,
} from "../data/types.ts";
import type { VisualState } from "../visualState.ts";

export const DESIGN_WIDTH = 1600;
// Used before the background image has loaded (and as the seed aspect ratio
// for any map created without one yet). Once loaded, the real design height
// is DESIGN_WIDTH * image.naturalHeight / image.naturalWidth - see
// MapCanvas.tsx.
export const DEFAULT_DESIGN_HEIGHT = 900;

export interface BubbleVisualProps {
    x: number; // 0 a 1
    y: number; // 0 a 1
    designSize: DesignSize;
    visualState: VisualState;
    skin: Skin["config"];
    icon?: Bubble["icon"];
    label?: string;
    draggable?: boolean;
    onClick?: () => void;
    onHoverChange?: (hovered: boolean) => void;
    onDragEnd?: (pos: { x: number; y: number }) => void;
    onDragStart?: () => void;
    // Bumping this value (e.g. to Date.now()) triggers the same
    // bounce+ring feedback used for a locked->complete transition, without
    // requiring a visual-state change. Used to highlight a bubble picked
    // from the activities overview panel.
    pulseKey?: number;
}

export interface MapCanvasProps {
    backgroundUrl: string;
    bubbles: Bubble[];
    editable: boolean;
    fit?: MapFit;
    mapMode?: MapMode;
    initialView?: MapInitialView | null;
    intro?: MapSettings["intro"];
    pathSettings?: MapSettings["path"];
    ambient?: MapSettings["ambient"];
    skins?: Skin[];
    defaultSkinId?: string | null;
    skinRules?: SkinRule[];
    onBubbleClick?: (bubble: Bubble) => void;
    onBubbleMove?: (bubbleId: string, x: number, y: number) => void;
    onBubbleUpdate?: (bubbleId: string, input: BubbleUpdate) => void;
    onBubbleDelete?: (bubbleId: string) => void;
    onActivityDrop?: (activityId: number, x: number, y: number) => void;
    // Student view: a non-null reason makes the bubble non-interactive and is
    // shown as a tooltip on hover.
    getUnavailableReason?: (bubble: Bubble) => string | null;
    // Used to derive a default icon (by Moodle modname) for bubbles with no
    // icon of their own, instead of the generic "?", and to resolve a skin
    // rule by activity type.
    getModnameForBubble?: (bubble: Bubble) => string | undefined;
    // From GET /course-maps/{id}/resolved, joined by bubbleId.
    getAvailability?: (bubble: Bubble) => Availability | undefined;
    getResolvedActivity?: (bubble: Bubble) => Activity | null;
    // One-shot request to center the viewport on a bubble and briefly
    // highlight it (from the activities overview panel). MapCanvas calls
    // onFocusHandled once it's done so the same bubble can be re-focused.
    focusBubbleId?: string | null;
    onFocusHandled?: () => void;
    // Reports the live camera center/zoom on every change (a ref write in
    // the parent, not state - this fires every pan/zoom tick). Backs the
    // appearance studio's "usar vista actual" capture.
    onViewportChange?: (view: MapInitialView) => void;
}
