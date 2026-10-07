import type { IconKey } from "../icons.ts";
import type { Activity, Availability, Bubble, BubbleStatus, BubbleUpdate } from "../data/types.ts";

export const DESIGN_WIDTH = 1600;
export const DESIGN_HEIGHT = 900;

// Fill is the "-dark" tone so white icons stay readable on it, except
// no_complete, which keeps the vivid "sun" tone (the call to action) and
// uses a dark-ink icon instead - see icons.ts for the two icon variants.
export const STATUS_COLORS: Record<BubbleStatus, string> = {
    locked: "#5b6478",
    no_complete: "#ffb703",
    in_progress: "#0b7a85",
    complete: "#178049",
};

// The vivid tone behind each fill, used for the idle glow/pulse ring only
// (decorative, not text-bearing, so it isn't held to the text contrast rule).
export const STATUS_GLOW_COLORS: Record<BubbleStatus, string> = {
    locked: "#8a94a6",
    no_complete: "#ffb703",
    in_progress: "#0e9aa7",
    complete: "#2fbf71",
};

export const STATUS_ICON_IS_DARK: Record<BubbleStatus, boolean> = {
    locked: false,
    no_complete: true,
    in_progress: false,
    complete: false,
};

export interface BubbleProps {
    x: number; // 0 a 1
    y: number; // 0 a 1
    status: BubbleStatus
    icon?: IconKey;
    draggable?: boolean;
    // Student view: dims the bubble to slate and disables its idle/hover
    // animation when the resolved availability is "hidden" or "missing".
    muted?: boolean;
    // Editor view: a coral ring flags a bubble whose activity no longer
    // exists in Moodle (resolved availability "missing").
    warningRing?: boolean;
    onClick?: () => void;
    onHoverChange?: (hovered: boolean) => void;
    onDragEnd?: (pos: { x: number; y: number }) => void;
    onDragStart?: () => void;
    // Bumping this value (e.g. to Date.now()) triggers the same
    // bounce+ring feedback used for a status->complete transition, without
    // requiring a status change. Used to highlight a bubble picked from the
    // activities overview panel.
    pulseKey?: number;
}

export interface MapCanvasProps {
    backgroundUrl: string;
    bubbles: Bubble[];
    editable: boolean;
    onBubbleClick?: (bubble: Bubble) => void;
    onBubbleMove?: (bubbleId: string, x: number, y: number) => void;
    onBubbleUpdate?: (bubbleId: string, input: BubbleUpdate) => void;
    onBubbleDelete?: (bubbleId: string) => void;
    onActivityDrop?: (activityId: number, x: number, y: number) => void;
    // Student view: a non-null reason makes the bubble non-interactive and is
    // shown as a tooltip on hover.
    getUnavailableReason?: (bubble: Bubble) => string | null;
    // Used to derive a default icon (by Moodle modname) for bubbles with no
    // icon of their own, instead of the generic "?".
    getModnameForBubble?: (bubble: Bubble) => string | undefined;
    // From GET /course-maps/{id}/resolved, joined by bubbleId.
    getAvailability?: (bubble: Bubble) => Availability | undefined;
    getResolvedActivity?: (bubble: Bubble) => Activity | null;
    // One-shot request to center the viewport on a bubble and briefly
    // highlight it (from the activities overview panel). MapCanvas calls
    // onFocusHandled once it's done so the same bubble can be re-focused.
    focusBubbleId?: string | null;
    onFocusHandled?: () => void;
}
