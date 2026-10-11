import { ApiError } from "./client.ts";
import type { AssetListParams, PublishedMapListParams } from "./types.ts";

// Draft data and published data live under separate roots so a draft edit can
// never invalidate what students see, and publishing refreshes only the
// published queries.
export const courseMapKeys = {
    list: (params: { q: string; moodleCourseId?: number }) => ["course-maps", "list", params] as const,
    byCourse: (moodleCourseId: number) => ["course-maps", "by-course", moodleCourseId] as const,
    detail: (courseMapId: string) => ["course-maps", courseMapId, "detail"] as const,
    resolved: (courseMapId: string, includeHidden: boolean) =>
        ["course-maps", courseMapId, "resolved", { includeHidden }] as const,
    activities: (courseMapId: string) => ["course-maps", courseMapId, "activities"] as const,
    activitiesList: (courseMapId: string, includeHidden: boolean, onlySection: boolean) =>
        [...courseMapKeys.activities(courseMapId), { includeHidden, onlySection }] as const,
    createBubble: (courseMapId: string) => ["course-maps", courseMapId, "create-bubble"] as const,
    publicationState: (courseMapId: string) => ["course-maps", courseMapId, "publication-state"] as const,
    publications: (courseMapId: string) => ["course-maps", courseMapId, "publications"] as const,
    skins: () => ["skins"] as const,
};

export const publishedKeys = {
    all: () => ["published"] as const,
    byCourse: (moodleCourseId: number) => ["published", "by-course", moodleCourseId] as const,
    list: (params: PublishedMapListParams) => ["published", "list", params] as const,
    detail: (courseMapId: string) => ["published", courseMapId, "detail"] as const,
    resolved: (courseMapId: string, includeHidden: boolean) =>
        ["published", courseMapId, "resolved", { includeHidden }] as const,
};

export const assetKeys = {
    all: () => ["assets"] as const,
    list: (params: AssetListParams) => ["assets", "list", params] as const,
};

// A 4xx answer is a definitive "no" (not found, conflict, bad input), so only
// transient failures are retried.
export const retryTransient = (failureCount: number, error: Error) =>
    !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 2;
