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
    title: string;
    moodleCourseId: number;
    imageUrl: string;
    bubbleCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface CourseMapRead {
    id: string;
    title: string;
    moodleCourseId: number;
    imageUrl: string;
    bubbles: Bubble[];
    createdAt: string;
    updatedAt: string;
}

// Kept as an alias: most of the existing code refers to the single-map detail
// shape by this name.
export type CourseMapDetail = CourseMapRead;

export interface CourseMapListParams {
    moodleCourseId?: number;
    q?: string;
    limit?: number;
    offset?: number;
}

export interface CourseMapListResult {
    items: CourseMapSummary[];
    total: number;
    limit: number;
    offset: number;
}

export interface CourseMapPatch {
    title?: string;
    imageUrl?: string;
}

export type MoodleStatus = "live" | "cached" | "unavailable";

export type Availability = "available" | "hidden" | "missing" | "unknown";

export interface ResolvedBubble {
    bubbleId: string;
    availability: Availability;
    activity: Activity | null;
}

export interface ResolvedCourseMap {
    moodleStatus: MoodleStatus;
    bubbles: ResolvedBubble[];
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
    title: string;
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
