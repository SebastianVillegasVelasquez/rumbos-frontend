import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { courseMapApi } from "./index.ts";
import {
    applyBubbleVersion,
    applyMapLevel,
    currentBubbleVersion,
    currentMapRevision,
    isStatusOnly,
    patchBubbleInCache,
    removeBubbleFromCache,
    replaceDraft,
} from "./draftCache.ts";
import { courseMapKeys, publishedKeys } from "./queryKeys.ts";
import { getWriteQueue } from "./writeQueues.ts";
import { isWriteDiscarded, type WriteJob } from "./writeQueue.ts";
import type {
    AppearanceUpdate,
    Bubble,
    BubbleUpdate,
    CourseMapDetail,
    CourseMapPatch,
    DraftReplaceResult,
} from "./types.ts";

// Every draft-content write goes through the map's FIFO queue (writeQueue.ts)
// with the revision/version read from the cache at the moment it runs.
// Status-only bubble updates are live demo data, unguarded by contract, and
// skip the queue entirely.

const invalidateListsAndState = (queryClient: QueryClient, courseMapId: string) => {
    void queryClient.invalidateQueries({ queryKey: courseMapKeys.publicationState(courseMapId) });
    void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === "course-maps" && (query.queryKey[1] === "list" || query.queryKey[1] === "by-course"),
    });
};

const contentKey = (bubbleId: string, input: BubbleUpdate) =>
    "x" in input ? `pos:${bubbleId}` : "icon" in input ? `icon:${bubbleId}` : `skin:${bubbleId}`;

// What a bubble looked like before the first of a run of collapsed edits, so a
// failed write can put it back. Keyed like the queue's collapse key.
const rollbackBase = new Map<string, Bubble>();

type BubbleVars = { bubbleId: string; input: BubbleUpdate };

export const useUpdateBubble = (courseMapId: string) => {
    const queryClient = useQueryClient();
    const detailKey = courseMapKeys.detail(courseMapId);
    return useMutation({
        mutationFn: ({ bubbleId, input }: BubbleVars) => {
            if (isStatusOnly(input)) return courseMapApi.updateBubble(courseMapId, bubbleId, input);
            const job: WriteJob<Bubble> = {
                target: `bubble:${bubbleId}`,
                collapseKey: contentKey(bubbleId, input),
                run: async () => {
                    const version = await currentBubbleVersion(queryClient, courseMapId, bubbleId);
                    const bubble = await courseMapApi.updateBubble(courseMapId, bubbleId, input, version);
                    applyBubbleVersion(queryClient, courseMapId, bubble);
                    return bubble;
                },
            };
            return getWriteQueue(courseMapId).enqueue(job);
        },
        onMutate: async ({ bubbleId, input }) => {
            const statusOnly = isStatusOnly(input);
            if (statusOnly) await queryClient.cancelQueries({ queryKey: detailKey });
            const previous = queryClient.getQueryData<CourseMapDetail>(detailKey)?.bubbles.find((bubble) => bubble.id === bubbleId);
            if (!statusOnly && previous) {
                const key = contentKey(bubbleId, input);
                if (!rollbackBase.has(key)) rollbackBase.set(key, previous);
            }
            patchBubbleInCache(queryClient, courseMapId, bubbleId, input);
            return { previous };
        },
        onSuccess: (_bubble, { bubbleId, input }) => {
            if (!isStatusOnly(input)) rollbackBase.delete(contentKey(bubbleId, input));
        },
        onError: (error, { bubbleId, input }, context) => {
            const key = contentKey(bubbleId, input);
            const base = isStatusOnly(input) ? context?.previous : rollbackBase.get(key);
            rollbackBase.delete(key);
            // After a conflict the host has already loaded the other person's
            // version; restoring ours would undo that.
            if (isWriteDiscarded(error)) return;
            if (base) {
                const restore = Object.fromEntries(Object.keys(input).map((field) => [field, base[field as keyof Bubble]]));
                patchBubbleInCache(queryClient, courseMapId, bubbleId, restore);
            }
            void queryClient.invalidateQueries({ queryKey: detailKey });
        },
        onSettled: (_data, _error, { input }) => {
            // Status writes don't go through the queue, so nothing else
            // reconciles them with the server.
            if (isStatusOnly(input)) {
                void queryClient.invalidateQueries({ queryKey: detailKey });
                // Status is live data shared with the student view (not a
                // draft edit), which picks it up on its next fetch.
                void queryClient.invalidateQueries({ queryKey: publishedKeys.all() });
            }
        },
    });
};

export const useDeleteBubble = (courseMapId: string) => {
    const queryClient = useQueryClient();
    const detailKey = courseMapKeys.detail(courseMapId);
    return useMutation({
        mutationFn: (bubbleId: string) =>
            getWriteQueue(courseMapId).enqueue<void>({
                target: `bubble:${bubbleId}`,
                run: async () => {
                    const version = await currentBubbleVersion(queryClient, courseMapId, bubbleId);
                    await courseMapApi.deleteBubble(courseMapId, bubbleId, version);
                },
            }),
        onMutate: (bubbleId) => {
            const previous = queryClient.getQueryData<CourseMapDetail>(detailKey);
            removeBubbleFromCache(queryClient, courseMapId, bubbleId);
            return { previous };
        },
        onError: (error, _bubbleId, context) => {
            if (isWriteDiscarded(error)) return;
            if (context?.previous) queryClient.setQueryData(detailKey, context.previous);
            void queryClient.invalidateQueries({ queryKey: detailKey });
        },
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: courseMapKeys.activities(courseMapId) });
        },
    });
};

export const useUpdateCourseMap = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ courseMapId, input }: { courseMapId: string; input: CourseMapPatch }) =>
            getWriteQueue(courseMapId).enqueue<CourseMapDetail>({
                target: "map",
                run: async () => {
                    const revision = await currentMapRevision(queryClient, courseMapId);
                    const map = await courseMapApi.patchCourseMap(courseMapId, input, revision);
                    applyMapLevel(queryClient, courseMapId, map);
                    return map;
                },
            }),
        onSuccess: (map) => invalidateListsAndState(queryClient, map.id),
    });
};

export const useUpdateAppearance = (courseMapId: string) => {
    const queryClient = useQueryClient();
    const detailKey = courseMapKeys.detail(courseMapId);
    return useMutation({
        mutationFn: (input: AppearanceUpdate) =>
            getWriteQueue(courseMapId).enqueue<CourseMapDetail>({
                target: "map",
                run: async () => {
                    const revision = await currentMapRevision(queryClient, courseMapId);
                    const map = await courseMapApi.updateAppearance(courseMapId, input, revision);
                    applyMapLevel(queryClient, courseMapId, map);
                    return map;
                },
            }),
        onMutate: (input) => {
            const previous = queryClient.getQueryData<CourseMapDetail>(detailKey);
            queryClient.setQueryData<CourseMapDetail>(detailKey, (current) => current && { ...current, ...input });
            return { previous };
        },
        onError: (error, _input, context) => {
            if (isWriteDiscarded(error)) return;
            if (context?.previous) queryClient.setQueryData(detailKey, context.previous);
            void queryClient.invalidateQueries({ queryKey: detailKey });
        },
        onSuccess: () => invalidateListsAndState(queryClient, courseMapId),
    });
};

const replaceDraftJob = (
    queryClient: QueryClient,
    courseMapId: string,
    call: (revision: number) => Promise<DraftReplaceResult>
): WriteJob<DraftReplaceResult> => ({
    target: "map",
    run: async () => {
        const revision = await currentMapRevision(queryClient, courseMapId);
        const result = await call(revision);
        replaceDraft(queryClient, courseMapId, result.map);
        return result;
    },
});

export const useDiscardChanges = (courseMapId: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () =>
            getWriteQueue(courseMapId).enqueue(
                replaceDraftJob(queryClient, courseMapId, (revision) => courseMapApi.discardChanges(courseMapId, revision))
            ),
        onSuccess: () => invalidateListsAndState(queryClient, courseMapId),
    });
};

export const useRestorePublication = (courseMapId: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (publicationNumber: number) =>
            getWriteQueue(courseMapId).enqueue(
                replaceDraftJob(queryClient, courseMapId, (revision) =>
                    courseMapApi.restorePublication(courseMapId, publicationNumber, revision)
                )
            ),
        onSuccess: () => invalidateListsAndState(queryClient, courseMapId),
    });
};
