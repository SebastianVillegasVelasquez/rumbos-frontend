import { apiRequest, apiUpload } from "./client.ts";
import type {
    Activity,
    AppearanceUpdate,
    Asset,
    AssetKind,
    Bubble,
    BubbleCreate,
    BubbleUpdate,
    CourseMapCreate,
    CourseMapDetail,
    CourseMapListParams,
    CourseMapListResult,
    CourseMapPatch,
    CourseMapSummary,
    ReorderBubblesInput,
    ReorderBubblesResult,
    ReorderCourseMapsInput,
    ReorderCourseMapsResult,
    ResolvedCourseMap,
    Skin,
    SkinCreate,
    SkinListResult,
    SkinPatch,
} from "./types.ts";

// The single seam between components and transport. Components use the query
// hooks in queries.ts, which call this; nothing else talks to the network.
export interface CourseMapApi {
    listCourseMaps(params: CourseMapListParams): Promise<CourseMapListResult>;
    createCourseMap(input: CourseMapCreate): Promise<CourseMapSummary>;
    getCourseMap(courseMapId: string): Promise<CourseMapDetail>;
    patchCourseMap(courseMapId: string, input: CourseMapPatch): Promise<CourseMapDetail>;
    deleteCourseMap(courseMapId: string): Promise<void>;
    reorderCourseMaps(input: ReorderCourseMapsInput): Promise<ReorderCourseMapsResult>;
    updateAppearance(courseMapId: string, input: AppearanceUpdate): Promise<CourseMapDetail>;
    getResolvedCourseMap(courseMapId: string, includeHidden: boolean): Promise<ResolvedCourseMap>;
    getActivities(courseMapId: string, includeHidden: boolean, onlySection: boolean): Promise<Activity[]>;
    createBubble(courseMapId: string, input: BubbleCreate): Promise<Bubble>;
    updateBubble(courseMapId: string, bubbleId: string, input: BubbleUpdate): Promise<Bubble>;
    deleteBubble(courseMapId: string, bubbleId: string): Promise<void>;
    reorderBubbles(courseMapId: string, input: ReorderBubblesInput): Promise<ReorderBubblesResult>;
    listSkins(): Promise<SkinListResult>;
    createSkin(input: SkinCreate): Promise<Skin>;
    patchSkin(skinId: string, input: SkinPatch): Promise<Skin>;
    deleteSkin(skinId: string): Promise<void>;
    createAsset(file: File, kind: AssetKind): Promise<Asset>;
}

const base = (courseMapId: string) => `/course-maps/${encodeURIComponent(courseMapId)}`;

const buildQuery = (params: Record<string, string | number | boolean | undefined>) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) search.set(key, String(value));
    }
    const query = search.toString();
    return query ? `?${query}` : "";
};

export const realCourseMapApi: CourseMapApi = {
    listCourseMaps: (params) =>
        apiRequest(`/course-maps${buildQuery(params as Record<string, string | number | boolean | undefined>)}`),

    createCourseMap: (input) => apiRequest("/course-maps", { method: "POST", body: input }),

    getCourseMap: (courseMapId) => apiRequest(base(courseMapId)),

    patchCourseMap: (courseMapId, input) =>
        apiRequest(base(courseMapId), { method: "PATCH", body: input }),

    deleteCourseMap: (courseMapId) => apiRequest(base(courseMapId), { method: "DELETE" }),

    reorderCourseMaps: (input) => apiRequest("/course-maps/order", { method: "PUT", body: input }),

    updateAppearance: (courseMapId, input) =>
        apiRequest(`${base(courseMapId)}/appearance`, { method: "PUT", body: input }),

    getResolvedCourseMap: (courseMapId, includeHidden) =>
        apiRequest(`${base(courseMapId)}/resolved${buildQuery({ includeHidden })}`),

    getActivities: (courseMapId, includeHidden, onlySection) =>
        apiRequest(`${base(courseMapId)}/activities${buildQuery({ includeHidden, onlySection })}`),

    createBubble: (courseMapId, input) =>
        apiRequest(`${base(courseMapId)}/bubbles`, { method: "POST", body: input }),

    updateBubble: (courseMapId, bubbleId, input) =>
        apiRequest(`${base(courseMapId)}/bubbles/${encodeURIComponent(bubbleId)}`, {
            method: "PATCH",
            body: input,
        }),

    deleteBubble: (courseMapId, bubbleId) =>
        apiRequest(`${base(courseMapId)}/bubbles/${encodeURIComponent(bubbleId)}`, { method: "DELETE" }),

    reorderBubbles: (courseMapId, input) =>
        apiRequest(`${base(courseMapId)}/bubbles/order`, { method: "PUT", body: input }),

    listSkins: () => apiRequest("/skins"),

    createSkin: (input) => apiRequest("/skins", { method: "POST", body: input }),

    patchSkin: (skinId, input) =>
        apiRequest(`/skins/${encodeURIComponent(skinId)}`, { method: "PATCH", body: input }),

    deleteSkin: (skinId) => apiRequest(`/skins/${encodeURIComponent(skinId)}`, { method: "DELETE" }),

    createAsset: (file, kind) => {
        const form = new FormData();
        form.set("file", file);
        form.set("kind", kind);
        return apiUpload("/assets", form);
    },
};
