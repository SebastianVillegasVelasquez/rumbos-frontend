// Mirrors the backend's camelCase JSON contract (app/schemas in rumbos-backend).

export type BubbleStatus = "locked" | "no_complete" | "in_progress" | "complete";

export type BubbleIcon = "question" | "chest" | "star" | "flag" | "book" | "video" | "trophy" | "lock";

export interface Bubble {
    id: string;
    courseMapId: string;
    activityId: number;
    x: number;
    y: number;
    icon: BubbleIcon | null;
    status: BubbleStatus;
    createdAt: string;
    updatedAt: string;
}

export interface CourseMapSummary {
    id: string;
    moodleCourseId: number;
    imageUrl: string;
    createdAt: string;
    updatedAt: string;
}

export interface CourseMapDetail extends CourseMapSummary {
    bubbles: Bubble[];
}

export interface Activity {
    activityId: number;
    name: string;
    modname: string;
    url: string;
    sectionName: string;
    sectionNumber: number;
    hidden: boolean;
    placed: boolean;
    bubbleId: string | null;
}

export interface CourseMapCreate {
    moodleCourseId: number;
    imageUrl: string;
}

export interface BubbleCreate {
    activityId: number;
    x: number;
    y: number;
    icon?: BubbleIcon;
}

// Partial update. x and y always travel together, and every field is non-null
// except icon, where null clears it.
export type BubbleUpdate =
    | { x: number; y: number }
    | { icon: BubbleIcon | null }
    | { status: BubbleStatus };
