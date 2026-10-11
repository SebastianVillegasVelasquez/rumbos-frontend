import { apiRequest, apiUpload } from "./client.ts";
import type {
    Activity,
    AppearanceUpdate,
    AssetCreate,
    AssetCreateResult,
    AssetListParams,
    AssetListResult,
    AssetPatch,
    Asset,
    Bubble,
    BubbleCreate,
    BubbleUpdate,
    CourseMapCreate,
    CourseMapDetail,
    CourseMapListParams,
    CourseMapListResult,
    CourseMapPatch,
    CourseMapSummary,
    DraftReplaceResult,
    PublicationListResult,
    PublicationState,
    PublicationSummary,
    PublishedMapListParams,
    PublishedMapListResult,
    PublishedMapRead,
    PublishInput,
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
    // `ifMatch` is the map revision / bubble version the caller last saw; the
    // guarded endpoints answer 428 without it and 412 when it is stale.
    patchCourseMap(courseMapId: string, input: CourseMapPatch, ifMatch: number): Promise<CourseMapDetail>;
    deleteCourseMap(courseMapId: string): Promise<void>;
    reorderCourseMaps(input: ReorderCourseMapsInput): Promise<ReorderCourseMapsResult>;
    updateAppearance(courseMapId: string, input: AppearanceUpdate, ifMatch: number): Promise<CourseMapDetail>;
    getResolvedCourseMap(courseMapId: string, includeHidden: boolean): Promise<ResolvedCourseMap>;
    getActivities(courseMapId: string, includeHidden: boolean, onlySection: boolean): Promise<Activity[]>;
    createBubble(courseMapId: string, input: BubbleCreate): Promise<Bubble>;
    // A status-only update is live demo data: no If-Match, no version bump.
    updateBubble(courseMapId: string, bubbleId: string, input: BubbleUpdate, ifMatch?: number): Promise<Bubble>;
    deleteBubble(courseMapId: string, bubbleId: string, ifMatch: number): Promise<void>;
    reorderBubbles(courseMapId: string, input: ReorderBubblesInput): Promise<ReorderBubblesResult>;
    listSkins(): Promise<SkinListResult>;
    createSkin(input: SkinCreate): Promise<Skin>;
    patchSkin(skinId: string, input: SkinPatch): Promise<Skin>;
    deleteSkin(skinId: string): Promise<void>;

    listAssets(params: AssetListParams): Promise<AssetListResult>;
    createAsset(input: AssetCreate): Promise<AssetCreateResult>;
    patchAsset(assetId: string, input: AssetPatch): Promise<Asset>;
    deleteAsset(assetId: string): Promise<void>;

    getPublicationState(courseMapId: string): Promise<PublicationState>;
    publish(courseMapId: string, input: PublishInput): Promise<PublicationSummary>;
    listPublications(courseMapId: string, limit?: number): Promise<PublicationListResult>;
    discardChanges(courseMapId: string, ifMatch: number): Promise<DraftReplaceResult>;
    restorePublication(courseMapId: string, publicationNumber: number, ifMatch: number): Promise<DraftReplaceResult>;

    listPublishedCourseMaps(params: PublishedMapListParams): Promise<PublishedMapListResult>;
    getPublishedCourseMap(courseMapId: string): Promise<PublishedMapRead>;
    getPublishedResolvedCourseMap(courseMapId: string, includeHidden: boolean): Promise<ResolvedCourseMap>;
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

    patchCourseMap: (courseMapId, input, ifMatch) =>
        apiRequest(base(courseMapId), { method: "PATCH", body: input, ifMatch }),

    deleteCourseMap: (courseMapId) => apiRequest(base(courseMapId), { method: "DELETE" }),

    reorderCourseMaps: (input) => apiRequest("/course-maps/order", { method: "PUT", body: input }),

    updateAppearance: (courseMapId, input, ifMatch) =>
        apiRequest(`${base(courseMapId)}/appearance`, { method: "PUT", body: input, ifMatch }),

    getResolvedCourseMap: (courseMapId, includeHidden) =>
        apiRequest(`${base(courseMapId)}/resolved${buildQuery({ includeHidden })}`),

    getActivities: (courseMapId, includeHidden, onlySection) =>
        apiRequest(`${base(courseMapId)}/activities${buildQuery({ includeHidden, onlySection })}`),

    createBubble: (courseMapId, input) =>
        apiRequest(`${base(courseMapId)}/bubbles`, { method: "POST", body: input }),

    updateBubble: (courseMapId, bubbleId, input, ifMatch) =>
        apiRequest(`${base(courseMapId)}/bubbles/${encodeURIComponent(bubbleId)}`, {
            method: "PATCH",
            body: input,
            ifMatch,
        }),

    deleteBubble: (courseMapId, bubbleId, ifMatch) =>
        apiRequest(`${base(courseMapId)}/bubbles/${encodeURIComponent(bubbleId)}`, { method: "DELETE", ifMatch }),

    reorderBubbles: (courseMapId, input) =>
        apiRequest(`${base(courseMapId)}/bubbles/order`, { method: "PUT", body: input }),

    listSkins: () => apiRequest("/skins"),

    createSkin: (input) => apiRequest("/skins", { method: "POST", body: input }),

    patchSkin: (skinId, input) =>
        apiRequest(`/skins/${encodeURIComponent(skinId)}`, { method: "PATCH", body: input }),

    deleteSkin: (skinId) => apiRequest(`/skins/${encodeURIComponent(skinId)}`, { method: "DELETE" }),

    listAssets: (params) =>
        apiRequest(`/assets${buildQuery(params as Record<string, string | number | boolean | undefined>)}`),

    createAsset: async ({ file, kind, title, credit }) => {
        const form = new FormData();
        form.set("file", file);
        form.set("kind", kind);
        if (title) form.set("title", title);
        if (credit) form.set("credit", credit);
        const { data, status } = await apiUpload<Asset>("/assets", form);
        return { asset: data, created: status !== 200 };
    },

    patchAsset: (assetId, input) =>
        apiRequest(`/assets/${encodeURIComponent(assetId)}`, { method: "PATCH", body: input }),

    deleteAsset: (assetId) => apiRequest(`/assets/${encodeURIComponent(assetId)}`, { method: "DELETE" }),

    getPublicationState: (courseMapId) => apiRequest(`${base(courseMapId)}/publication-state`),

    publish: (courseMapId, input) =>
        apiRequest(`${base(courseMapId)}/publish`, { method: "POST", body: input }),

    listPublications: (courseMapId, limit) =>
        apiRequest(`${base(courseMapId)}/publications${buildQuery({ limit })}`),

    discardChanges: (courseMapId, ifMatch) =>
        apiRequest(`${base(courseMapId)}/discard-changes`, { method: "POST", ifMatch }),

    restorePublication: (courseMapId, publicationNumber, ifMatch) =>
        apiRequest(`${base(courseMapId)}/publications/${publicationNumber}/restore`, { method: "POST", ifMatch }),

    listPublishedCourseMaps: (params) =>
        apiRequest(`/published/course-maps${buildQuery(params as Record<string, string | number | boolean | undefined>)}`),

    getPublishedCourseMap: (courseMapId) => apiRequest(`/published/course-maps/${encodeURIComponent(courseMapId)}`),

    getPublishedResolvedCourseMap: (courseMapId, includeHidden) =>
        apiRequest(`/published/course-maps/${encodeURIComponent(courseMapId)}/resolved${buildQuery({ includeHidden })}`),
};
