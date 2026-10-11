import type { QueryClient } from "@tanstack/react-query";
import { courseMapApi } from "./index.ts";
import { ApiError } from "./client.ts";
import { courseMapKeys } from "./queryKeys.ts";
import { getWriteQueue } from "./writeQueues.ts";
import type { Bubble, BubbleUpdate, CourseMapDetail } from "./types.ts";

// Revisions and versions live in the query cache right next to the data they
// belong to. Responses to guarded writes update them before the next queued
// write runs, which is what keeps a user from conflicting with themselves.

const detailKey = courseMapKeys.detail;

export const patchBubbleInCache = (queryClient: QueryClient, mapId: string, bubbleId: string, patch: Partial<Bubble>) =>
    queryClient.setQueryData<CourseMapDetail>(
        detailKey(mapId),
        (current) =>
            current && {
                ...current,
                bubbles: current.bubbles.map((bubble) => (bubble.id === bubbleId ? { ...bubble, ...patch } : bubble)),
            }
    );

export const removeBubbleFromCache = (queryClient: QueryClient, mapId: string, bubbleId: string) =>
    queryClient.setQueryData<CourseMapDetail>(
        detailKey(mapId),
        (current) => current && { ...current, bubbles: current.bubbles.filter((bubble) => bubble.id !== bubbleId) }
    );

// After a bubble write only the version bookkeeping is taken from the
// response: x/y/icon may already have moved on optimistically for a later edit.
export const applyBubbleVersion = (queryClient: QueryClient, mapId: string, bubble: Bubble) =>
    patchBubbleInCache(queryClient, mapId, bubble.id, { version: bubble.version, updatedAt: bubble.updatedAt });

// A map-level response carries a snapshot of the bubbles from before any
// queued bubble edit ran, so only the map-level fields are merged.
export const applyMapLevel = (queryClient: QueryClient, mapId: string, response: CourseMapDetail) =>
    queryClient.setQueryData<CourseMapDetail>(
        detailKey(mapId),
        (current) =>
            current
                ? {
                      ...current,
                      title: response.title,
                      imageUrl: response.imageUrl,
                      settings: response.settings,
                      defaultSkinId: response.defaultSkinId,
                      skinRules: response.skinRules,
                      revision: response.revision,
                      updatedAt: response.updatedAt,
                  }
                : response
    );

// Discard/restore replace the whole draft, bubbles and their versions included.
export const replaceDraft = (queryClient: QueryClient, mapId: string, map: CourseMapDetail) =>
    queryClient.setQueryData<CourseMapDetail>(detailKey(mapId), map);

// Straight to the server, bypassing the consistency wait: used when resolving a
// conflict, while the queue is deliberately halted.
export const reloadDraft = async (queryClient: QueryClient, mapId: string) => {
    const fresh = await courseMapApi.getCourseMap(mapId);
    queryClient.setQueryData(detailKey(mapId), fresh);
    return fresh;
};

// A fetch is only trusted if no guarded write was enqueued or settled while it
// was in flight; otherwise it could carry an older version than the cache.
export const fetchDraftConsistently = async (queryClient: QueryClient, mapId: string): Promise<CourseMapDetail> => {
    const queue = getWriteQueue(mapId);
    for (let attempt = 0; attempt < 4; attempt++) {
        await queue.whenIdle();
        const epoch = queue.epoch();
        const fresh = await courseMapApi.getCourseMap(mapId);
        if (queue.epoch() === epoch && !queue.isBusy()) return fresh;
    }
    return queryClient.getQueryData<CourseMapDetail>(detailKey(mapId)) ?? courseMapApi.getCourseMap(mapId);
};

export const currentMapRevision = async (queryClient: QueryClient, mapId: string): Promise<number> => {
    const cached = queryClient.getQueryData<CourseMapDetail>(detailKey(mapId));
    return (cached ?? (await reloadDraft(queryClient, mapId))).revision;
};

export const currentBubbleVersion = async (queryClient: QueryClient, mapId: string, bubbleId: string): Promise<number> => {
    const find = (map: CourseMapDetail | undefined) => map?.bubbles.find((bubble) => bubble.id === bubbleId)?.version;
    const cached = find(queryClient.getQueryData<CourseMapDetail>(detailKey(mapId)));
    if (cached !== undefined) return cached;
    const fresh = find(await reloadDraft(queryClient, mapId));
    if (fresh === undefined) throw new ApiError(404, { code: "bubble_not_found", message: "Burbuja no encontrada" });
    return fresh;
};

export const isStatusOnly = (input: BubbleUpdate) => Object.keys(input).every((key) => key === "status");
