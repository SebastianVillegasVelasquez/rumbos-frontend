import { keepPreviousData, useInfiniteQuery, useMutation, useMutationState, useQuery, useQueryClient } from "@tanstack/react-query";
import { courseMapApi } from "./index.ts";
import { fetchDraftConsistently } from "./draftCache.ts";
import { getWriteQueue } from "./writeQueues.ts";
import { assetKeys, courseMapKeys, publishedKeys, retryTransient } from "./queryKeys.ts";
import type {
    AssetCreate,
    AssetListParams,
    AssetPatch,
    BubbleCreate,
    CourseMapDetail,
    PublishInput,
    ReorderCourseMapsInput,
    SkinConfig,
    SkinPatch,
} from "./types.ts";

export { assetKeys, courseMapKeys, publishedKeys };

const LIST_PAGE_SIZE = 24;

// The draft is fetched only when no guarded write overlaps the request (see
// fetchDraftConsistently), so a refetch can never hand back an older version
// than the one an in-flight write has just produced.
export const useCourseMap = (courseMapId: string | null) =>
    useQuery({
        queryKey: courseMapKeys.detail(courseMapId ?? ""),
        queryFn: ({ client }) => fetchDraftConsistently(client, courseMapId!),
        enabled: courseMapId !== null,
        retry: retryTransient,
    });

export const useCourseMaps = (params: { q: string; moodleCourseId?: number }) =>
    useInfiniteQuery({
        queryKey: courseMapKeys.list(params),
        queryFn: ({ pageParam }) =>
            courseMapApi.listCourseMaps({ ...params, limit: LIST_PAGE_SIZE, offset: pageParam }),
        initialPageParam: 0,
        getNextPageParam: (lastPage) =>
            lastPage.offset + lastPage.items.length < lastPage.total
                ? lastPage.offset + lastPage.items.length
                : undefined,
        retry: retryTransient,
    });

// All of a course's levels, ordered by position - small enough (a handful of
// levels, never paginated) to use a plain query instead of useCourseMaps'
// infinite/search-oriented one.
export const useCourseMapsByCourse = (moodleCourseId: number | null) =>
    useQuery({
        queryKey: courseMapKeys.byCourse(moodleCourseId ?? -1),
        queryFn: () => courseMapApi.listCourseMaps({ moodleCourseId: moodleCourseId!, limit: 100 }),
        enabled: moodleCourseId !== null,
        retry: retryTransient,
        select: (result) => result.items,
    });

// includeHidden=false for the student view, true for the editor.
export const useResolvedCourseMap = (courseMapId: string | null, includeHidden: boolean) =>
    useQuery({
        queryKey: courseMapKeys.resolved(courseMapId ?? "", includeHidden),
        queryFn: () => courseMapApi.getResolvedCourseMap(courseMapId!, includeHidden),
        enabled: courseMapId !== null,
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        retry: retryTransient,
    });

export const useDeleteCourseMap = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (courseMapId: string) => courseMapApi.deleteCourseMap(courseMapId),
        onSuccess: () => {
            void invalidateCourseMapLists(queryClient);
        },
    });
};

export const useActivities = (courseMapId: string | null, includeHidden: boolean, onlySection: boolean) =>
    useQuery({
        queryKey: courseMapKeys.activitiesList(courseMapId ?? "", includeHidden, onlySection),
        queryFn: () => courseMapApi.getActivities(courseMapId!, includeHidden, onlySection),
        enabled: courseMapId !== null,
        retry: retryTransient,
    });

const isCourseMapListKey = (key: readonly unknown[]) =>
    key[0] === "course-maps" && (key[1] === "list" || key[1] === "by-course");

const invalidateCourseMapLists = (queryClient: ReturnType<typeof useQueryClient>) =>
    queryClient.invalidateQueries({ predicate: (query) => isCourseMapListKey(query.queryKey) });

interface PositionedItem {
    id: string;
    position?: number;
}

const withPatchedPositions = <T extends PositionedItem>(items: T[], positionById: Map<string, number>): T[] =>
    items
        .map((item) => (positionById.has(item.id) ? { ...item, position: positionById.get(item.id) } : item))
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

// Optimistic across the whole course: a drag-reorder should feel instant, and
// on failure every map in the course reverts, not just one. Patches both
// shapes a course-maps list query can have: useCourseMaps' infinite
// {pages:[{items}]} and useCourseMapsByCourse's plain {items}.
export const useReorderCourseMaps = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: ReorderCourseMapsInput) => courseMapApi.reorderCourseMaps(input),
        onMutate: async (input) => {
            await queryClient.cancelQueries({ predicate: (query) => isCourseMapListKey(query.queryKey) });
            const snapshots = queryClient.getQueriesData<
                { pages: { items: PositionedItem[] }[] } | { items: PositionedItem[] }
            >({ predicate: (query) => isCourseMapListKey(query.queryKey) });
            const positionById = new Map(input.mapIds.map((id, index) => [id, index]));
            for (const [key, data] of snapshots) {
                if (!data) continue;
                if ("pages" in data) {
                    queryClient.setQueryData(key, {
                        ...data,
                        pages: data.pages.map((page) => ({ ...page, items: withPatchedPositions(page.items, positionById) })),
                    });
                } else {
                    queryClient.setQueryData(key, { ...data, items: withPatchedPositions(data.items, positionById) });
                }
            }
            return { snapshots };
        },
        onError: (_error, _input, context) => {
            context?.snapshots.forEach(([key, data]) => queryClient.setQueryData(key, data));
        },
        onSettled: () => {
            void invalidateCourseMapLists(queryClient);
        },
    });
};

// Optimistic across the whole bubble list (unlike useUpdateBubble, which
// patches a single bubble): a reorder drag needs every sequence to update at
// once, and a failure needs every sequence to roll back at once.
export const useReorderBubbles = (courseMapId: string) => {
    const queryClient = useQueryClient();
    const detailKey = courseMapKeys.detail(courseMapId);
    return useMutation({
        mutationFn: (bubbleIds: string[]) => courseMapApi.reorderBubbles(courseMapId, { bubbleIds }),
        onMutate: async (bubbleIds) => {
            await queryClient.cancelQueries({ queryKey: detailKey });
            const previous = queryClient.getQueryData<CourseMapDetail>(detailKey);
            const sequenceById = new Map(bubbleIds.map((id, index) => [id, index]));
            queryClient.setQueryData<CourseMapDetail>(detailKey, (current) =>
                current && {
                    ...current,
                    bubbles: current.bubbles.map((bubble) =>
                        sequenceById.has(bubble.id) ? { ...bubble, sequence: sequenceById.get(bubble.id)! } : bubble
                    ),
                }
            );
            return { previous };
        },
        onError: (_error, _bubbleIds, context) => {
            if (context?.previous) queryClient.setQueryData(detailKey, context.previous);
        },
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: detailKey });
        },
    });
};

export const useSkins = () =>
    useQuery({
        queryKey: courseMapKeys.skins(),
        queryFn: () => courseMapApi.listSkins(),
        retry: retryTransient,
    });

export const useCreateSkin = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ name, config }: { name: string; config: SkinConfig }) =>
            courseMapApi.createSkin({ name, config }),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: courseMapKeys.skins() });
        },
    });
};

export const useUpdateSkin = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ skinId, input }: { skinId: string; input: SkinPatch }) => courseMapApi.patchSkin(skinId, input),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: courseMapKeys.skins() });
        },
    });
};

export const useDeleteSkin = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (skinId: string) => courseMapApi.deleteSkin(skinId),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: courseMapKeys.skins() });
        },
    });
};

export const useAssets = (params: AssetListParams, enabled = true) =>
    useQuery({
        queryKey: assetKeys.list(params),
        queryFn: () => courseMapApi.listAssets(params),
        placeholderData: keepPreviousData,
        enabled,
        retry: retryTransient,
    });

export const useCreateAsset = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: AssetCreate) => courseMapApi.createAsset(input),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: assetKeys.all() });
        },
    });
};

export const usePatchAsset = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ assetId, input }: { assetId: string; input: AssetPatch }) => courseMapApi.patchAsset(assetId, input),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: assetKeys.all() });
        },
    });
};

export const useDeleteAsset = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (assetId: string) => courseMapApi.deleteAsset(assetId),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: assetKeys.all() });
        },
    });
};

export const useCreateCourseMap = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: courseMapApi.createCourseMap,
        onSuccess: () => {
            // createCourseMap only returns a CourseMapSummary, which is
            // missing settings/defaultSkinId/skinRules/bubbles - seeding the
            // detail cache with it would make useCourseMap's data look like
            // a complete CourseMapDetail while actually being incomplete
            // (e.g. `.settings` undefined), crashing anything that reads
            // those fields before the real fetch lands. Let the navigation
            // to the new map's detail route do a normal fetch instead.
            void invalidateCourseMapLists(queryClient);
        },
    });
};

// Activity ids with a create request in flight, so the sidebar can't start a
// second create for the same activity while the first is pending.
export const usePendingActivityIds = (courseMapId: string) =>
    useMutationState({
        filters: { mutationKey: courseMapKeys.createBubble(courseMapId), status: "pending" },
        select: (mutation) => (mutation.state.variables as BubbleCreate).activityId,
    });

export const useCreateBubble = (courseMapId: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: courseMapKeys.createBubble(courseMapId),
        mutationFn: (input: BubbleCreate) => courseMapApi.createBubble(courseMapId, input),
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: courseMapKeys.detail(courseMapId) });
            void queryClient.invalidateQueries({ queryKey: courseMapKeys.activities(courseMapId) });
        },
    });
};

// ---- Draft vs published -------------------------------------------------------

// Reads wait for the map's write queue to drain so the diff and the hash the
// editor reviews describe the draft the server actually has.
export const usePublicationState = (courseMapId: string | null) =>
    useQuery({
        queryKey: courseMapKeys.publicationState(courseMapId ?? ""),
        queryFn: async () => {
            await getWriteQueue(courseMapId!).whenIdle();
            return courseMapApi.getPublicationState(courseMapId!);
        },
        enabled: courseMapId !== null,
        retry: retryTransient,
    });

export const usePublications = (courseMapId: string | null, enabled: boolean) =>
    useQuery({
        queryKey: courseMapKeys.publications(courseMapId ?? ""),
        queryFn: () => courseMapApi.listPublications(courseMapId!, 50),
        enabled: enabled && courseMapId !== null,
        retry: retryTransient,
    });

export const usePublish = (courseMapId: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: PublishInput) => courseMapApi.publish(courseMapId, input),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: courseMapKeys.publicationState(courseMapId) });
            void queryClient.invalidateQueries({ queryKey: courseMapKeys.publications(courseMapId) });
            void invalidateCourseMapLists(queryClient);
            // Publishing is the one action that changes what students see.
            void queryClient.invalidateQueries({ queryKey: publishedKeys.all() });
        },
    });
};

// ---- Published (student) read API ------------------------------------------------

export const usePublishedMapsByCourse = (moodleCourseId: number | null) =>
    useQuery({
        queryKey: publishedKeys.byCourse(moodleCourseId ?? -1),
        queryFn: () => courseMapApi.listPublishedCourseMaps({ moodleCourseId: moodleCourseId!, limit: 100 }),
        enabled: moodleCourseId !== null,
        retry: retryTransient,
        select: (result) => result.items,
    });

export const usePublishedCourseMap = (courseMapId: string | null) =>
    useQuery({
        queryKey: publishedKeys.detail(courseMapId ?? ""),
        queryFn: () => courseMapApi.getPublishedCourseMap(courseMapId!),
        enabled: courseMapId !== null,
        retry: retryTransient,
    });

export const usePublishedResolvedCourseMap = (courseMapId: string | null, includeHidden: boolean) =>
    useQuery({
        queryKey: publishedKeys.resolved(courseMapId ?? "", includeHidden),
        queryFn: () => courseMapApi.getPublishedResolvedCourseMap(courseMapId!, includeHidden),
        enabled: courseMapId !== null,
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        retry: retryTransient,
    });
