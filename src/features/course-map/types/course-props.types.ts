export type BubbleStatus = "no_complete" | "in_progress" | "complete" | "locked";
export type ActivityType = "quiz" | "url" | "assign" | "resource";
export const DESIGN_WIDTH = 1600;
export const DESIGN_HEIGHT = 900;


export interface BubbleData {
    bubbleId: number;
    activityId: number; //This is the activity id coming from Moodle
    // Do not use 'x' and 'y' to store pixels,
    // instead use 0 to 1 scale.
    x: number;
    y: number;
    icon?: string; // This may have a default have
    status: BubbleStatus;
}

export interface Activity {
    id: number; // Moodle activity id
    name: string;
    type: ActivityType;
}

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
    draggable?: boolean;
    onClick?: () => void;
    onDragEnd?: (pos: { x: number; y: number }) => void;
}

export interface CourseMap {
    courseId: number;
    imageUrl: string;
    bubbles: BubbleData[];
}

export interface MapCanvasProps {
    backgroundUrl: string;
    bubbles: BubbleData[];
    editable: boolean;
    onBubblesChange?: (bubbles: BubbleData[]) => void;
    onBubbleClick?: (bubble: BubbleData) => void;
}
