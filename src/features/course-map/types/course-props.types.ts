import type { IconKey } from "../icons.ts";
import type { Bubble, BubbleStatus, BubbleUpdate } from "../data/types.ts";

export const DESIGN_WIDTH = 1600;
export const DESIGN_HEIGHT = 900;

export const STATUS_COLORS: Record<BubbleStatus, string> = {
    locked: "#6b7280",
    no_complete: "#3b82f6",
    in_progress: "#f59e0b",
    complete: "#22c55e",
};

export interface BubbleProps {
    x: number; // 0 a 1
    y: number; // 0 a 1
    status: BubbleStatus
    icon?: IconKey;
    draggable?: boolean;
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
    // One-shot request to center the viewport on a bubble and briefly
    // highlight it (from the activities overview panel). MapCanvas calls
    // onFocusHandled once it's done so the same bubble can be re-focused.
    focusBubbleId?: string | null;
    onFocusHandled?: () => void;
}
