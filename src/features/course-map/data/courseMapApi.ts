import { apiRequest } from "./client.ts";
import type {
    Activity,
    Bubble,
    BubbleCreate,
    BubbleUpdate,
    CourseMapCreate,
    CourseMapDetail,
    CourseMapListParams,
    CourseMapListResult,
    CourseMapPatch,
    CourseMapSummary,
    ResolvedCourseMap,
} from "./types.ts";

// The single seam between components and transport. Components use the query
// hooks in queries.ts, which call this; nothing else talks to the network.
export interface CourseMapApi {
    listCourseMaps(params: CourseMapListParams): Promise<CourseMapListResult>;
    createCourseMap(input: CourseMapCreate): Promise<CourseMapSummary>;
    getCourseMap(courseMapId: string): Promise<CourseMapDetail>;
    patchCourseMap(courseMapId: string, input: CourseMapPatch): Promise<CourseMapDetail>;
    deleteCourseMap(courseMapId: string): Promise<void>;
    getResolvedCourseMap(courseMapId: string, includeHidden: boolean): Promise<ResolvedCourseMap>;
    getActivities(courseMapId: string, includeHidden: boolean): Promise<Activity[]>;
    createBubble(courseMapId: string, input: BubbleCreate): Promise<Bubble>;
    updateBubble(courseMapId: string, bubbleId: string, input: BubbleUpdate): Promise<Bubble>;
    deleteBubble(courseMapId: string, bubbleId: string): Promise<void>;
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

    getResolvedCourseMap: (courseMapId, includeHidden) =>
        apiRequest(`${base(courseMapId)}/resolved${buildQuery({ includeHidden })}`),

    getActivities: (courseMapId, includeHidden) =>
        apiRequest(`${base(courseMapId)}/activities?includeHidden=${includeHidden}`),

    createBubble: (courseMapId, input) =>
        apiRequest(`${base(courseMapId)}/bubbles`, { method: "POST", body: input }),

    updateBubble: (courseMapId, bubbleId, input) =>
        apiRequest(`${base(courseMapId)}/bubbles/${encodeURIComponent(bubbleId)}`, {
            method: "PATCH",
            body: input,
        }),

    deleteBubble: (courseMapId, bubbleId) =>
        apiRequest(`${base(courseMapId)}/bubbles/${encodeURIComponent(bubbleId)}`, { method: "DELETE" }),
};
