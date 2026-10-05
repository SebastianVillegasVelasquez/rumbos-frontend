import { apiRequest } from "./client.ts";
import type {
    Activity,
    Bubble,
    BubbleCreate,
    BubbleUpdate,
    CourseMapCreate,
    CourseMapDetail,
    CourseMapSummary,
} from "./types.ts";

// The single seam between components and transport. Components use the query
// hooks in queries.ts, which call this; nothing else talks to the network.
export interface CourseMapApi {
    createCourseMap(input: CourseMapCreate): Promise<CourseMapSummary>;
    getCourseMap(courseMapId: string): Promise<CourseMapDetail>;
    getActivities(courseMapId: string, includeHidden: boolean): Promise<Activity[]>;
    createBubble(courseMapId: string, input: BubbleCreate): Promise<Bubble>;
    updateBubble(courseMapId: string, bubbleId: string, input: BubbleUpdate): Promise<Bubble>;
    deleteBubble(courseMapId: string, bubbleId: string): Promise<void>;
}

const base = (courseMapId: string) => `/course-maps/${encodeURIComponent(courseMapId)}`;

export const realCourseMapApi: CourseMapApi = {
    createCourseMap: (input) => apiRequest("/course-maps", { method: "POST", body: input }),

    getCourseMap: (courseMapId) => apiRequest(base(courseMapId)),

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
