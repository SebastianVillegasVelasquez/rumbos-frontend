// Mirrors the backend's camelCase JSON contract (app/schemas in rumbos-backend).
// Contract v2: several maps ("levels") per course, map settings/appearance,
// procedural and image skins, and an asset store for backgrounds/bubble art.

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
    skinId: string | null;
    sequence: number;
    createdAt: string;
    updatedAt: string;
}

export interface CourseMapSummary {
    id: string;
    title: string;
    moodleCourseId: number;
    moodleSectionId: number | null;
    position: number;
    imageUrl: string;
    bubbleCount: number;
    completeCount: number;
    createdAt: string;
    updatedAt: string;
}

export type MapFit = "original" | "fit-width" | "fit-height" | "contain";

export type MapMode = "explorative" | "guided";

export type PathStyle = "dashed" | "solid" | "dotted";

export type AmbientKind = "none" | "fireflies" | "snow" | "leaves" | "clouds" | "sparkles";

export type MapIntro = "none" | "flyin";

export interface MapInitialView {
    x: number;
    y: number;
    zoom: number;
}

export interface MapSettings {
    schemaVersion: 1;
    mode: MapMode;
    fit: MapFit;
    initialView: MapInitialView | null;
    path: {
        visible: boolean;
        style: PathStyle;
        color: string | null;
        animated: boolean;
    };
    ambient: {
        kind: AmbientKind;
        intensity: number;
    };
    intro: MapIntro;
}

export interface SkinRule {
    modname: string;
    skinId: string;
}

export interface CourseMapRead {
    id: string;
    title: string;
    moodleCourseId: number;
    moodleSectionId: number | null;
    position: number;
    imageUrl: string;
    settings: MapSettings;
    defaultSkinId: string | null;
    skinRules: SkinRule[];
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

export interface ReorderCourseMapsInput {
    moodleCourseId: number;
    mapIds: string[];
}

export interface ReorderCourseMapsResult {
    items: CourseMapSummary[];
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
    sectionId: number;
    sectionName: string;
    sectionNumber: number;
    hidden: boolean;
    // True when placed on ANY map of the course, not just the current one.
    placed: boolean;
    bubbleId: string | null;
    placedInMapId: string | null;
}

export interface CourseMapCreate {
    title: string;
    moodleCourseId: number;
    imageUrl: string;
    moodleSectionId?: number;
}

export interface BubbleCreate {
    activityId: number;
    x: number;
    y: number;
    icon?: BubbleIcon;
}

// Partial update. x and y always travel together, and every field is non-null
// except icon/skinId, where null clears the override. `sequence` only
// changes through the bubble-order endpoint.
export type BubbleUpdate =
    | { x: number; y: number }
    | { icon: BubbleIcon | null }
    | { status: BubbleStatus }
    | { skinId: string | null };

export interface ReorderBubblesInput {
    bubbleIds: string[];
}

export interface ReorderBubblesResult {
    bubbles: Bubble[];
}

export interface AppearanceUpdate {
    settings: MapSettings;
    defaultSkinId: string | null;
    skinRules: SkinRule[];
}

// ---- Skins ----------------------------------------------------------------

export type SkinShape = "circle" | "hexagon" | "badge" | "pin";

export type SkinIdleEffect = "none" | "float" | "pulse" | "breathe";

export type SkinCompletionEffect = "none" | "ripple" | "burst";

export type SkinIconMode = "auto" | "preset" | "none";

export type SkinLabelMode = "hover" | "always" | "never";

export interface SkinPaletteEntry {
    fill: string;
    accent: string;
    glow: string;
}

export interface SkinPalette {
    locked: SkinPaletteEntry;
    available: SkinPaletteEntry;
    inProgress: SkinPaletteEntry;
    complete: SkinPaletteEntry;
}

export interface ProceduralSkin {
    schemaVersion: 1;
    kind: "procedural";
    shape: SkinShape;
    size: number;
    palette: SkinPalette;
    icon: {
        mode: SkinIconMode;
        preset: BubbleIcon | null;
        color: "auto" | string;
    };
    label: {
        mode: SkinLabelMode;
    };
    effects: {
        idle: SkinIdleEffect;
        ring: boolean;
        glow: boolean;
        completion: SkinCompletionEffect;
    };
}

export type ImageSkinState = "available" | "locked" | "next" | "inProgress" | "complete" | "hover";

export interface ImageSkin {
    schemaVersion: 1;
    kind: "image";
    size: number;
    anchor: "center" | "bottom";
    states: {
        available: string;
        locked: string | null;
        next: string | null;
        inProgress: string | null;
        complete: string | null;
        hover: string | null;
    };
    label: {
        mode: SkinLabelMode;
    };
    effects: {
        idle: "none" | "float" | "breathe";
        completion: SkinCompletionEffect;
    };
}

export type SkinConfig = ProceduralSkin | ImageSkin;

export interface Skin {
    id: string;
    name: string;
    builtin: boolean;
    isDefault: boolean;
    config: SkinConfig;
    createdAt: string;
    updatedAt: string;
}

export interface SkinCreate {
    name: string;
    config: SkinConfig;
}

export interface SkinPatch {
    name?: string;
    config?: SkinConfig;
}

export interface SkinListResult {
    items: Skin[];
}

// ---- Assets -----------------------------------------------------------------

export type AssetKind = "background" | "bubble";

export interface Asset {
    id: string;
    kind: AssetKind;
    mime: string;
    width: number;
    height: number;
    bytes: number;
    url: string;
    thumbUrl: string | null;
    createdAt: string;
}

// ---- Errors -----------------------------------------------------------------

// Business errors use `detail = { code, message, ...extras }`.
export interface ApiErrorDetail {
    code: string;
    message: string;
    [extra: string]: unknown;
}
