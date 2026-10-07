import { useInfiniteQuery, useMutation, useMutationState, useQuery, useQueryClient } from "@tanstack/react-query";
import { courseMapApi } from "./index.ts";
import { ApiError } from "./client.ts";
import type {
    AppearanceUpdate,
    AssetKind,
    BubbleCreate,
    BubbleUpdate,
    CourseMapDetail,
    CourseMapPatch,
    ReorderCourseMapsInput,
    SkinConfig,
    SkinPatch,
} from "./types.ts";

const LIST_PAGE_SIZE = 24;

export const courseMapKeys = {
    list: (params: { q: string; moodleCourseId?: number }) => ["course-maps", "list", params] as const,
    detail: (courseMapId: string) => ["course-maps", courseMapId, "detail"] as const,
    resolved: (courseMapId: string, includeHidden: boolean) =>
        ["course-maps", courseMapId, "resolved", { includeHidden }] as const,
    activities: (courseMapId: string) => ["course-maps", courseMapId, "activities"] as const,
    activitiesList: (courseMapId: string, includeHidden: boolean, onlySection: boolean) =>
        [...courseMapKeys.activities(courseMapId), { includeHidden, onlySection }] as const,
    createBubble: (courseMapId: string) => ["course-maps", courseMapId, "create-bubble"] as const,
    skins: () => ["skins"] as const,
};

// A 4xx answer is a definitive "no" (not found, conflict, bad input), so only
// transient failures are retried.
const retryTransient = (failureCount: number, error: Error) =>
    !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 2;

export const useCourseMap = (courseMapId: string | null) =>
    useQuery({
        queryKey: courseMapKeys.detail(courseMapId ?? ""),
        queryFn: () => courseMapApi.getCourseMap(courseMapId!),
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

export const useUpdateCourseMap = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ courseMapId, input }: { courseMapId: string; input: CourseMapPatch }) =>
            courseMapApi.patchCourseMap(courseMapId, input),
        onSuccess: (map) => {
            queryClient.setQueryData(courseMapKeys.detail(map.id), map);
            void queryClient.invalidateQueries({ queryKey: ["course-maps", "list"] });
        },
    });
};

export const useDeleteCourseMap = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (courseMapId: string) => courseMapApi.deleteCourseMap(courseMapId),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["course-maps", "list"] });
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

// Optimistic across the whole course: a drag-reorder should feel instant, and
// on failure every map in the course reverts, not just one.
export const useReorderCourseMaps = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: ReorderCourseMapsInput) => courseMapApi.reorderCourseMaps(input),
        onMutate: async (input) => {
            const listKey = ["course-maps", "list"] as const;
            await queryClient.cancelQueries({ queryKey: listKey });
            const snapshots = queryClient.getQueriesData<{ pages: { items: { id: string }[] }[] }>({ queryKey: listKey });
            const positionById = new Map(input.mapIds.map((id, index) => [id, index]));
            for (const [key, data] of snapshots) {
                if (!data) continue;
                queryClient.setQueryData(key, {
                    ...data,
                    pages: data.pages.map((page) => ({
                        ...page,
                        items: page.items
                            .map((item) => (positionById.has(item.id) ? { ...item, position: positionById.get(item.id) } : item))
                            .sort((a, b) => {
                                const posA = (a as { position?: number }).position ?? 0;
                                const posB = (b as { position?: number }).position ?? 0;
                                return posA - posB;
                            }),
                    })),
                });
            }
            return { snapshots };
        },
        onError: (_error, _input, context) => {
            context?.snapshots.forEach(([key, data]) => queryClient.setQueryData(key, data));
        },
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: ["course-maps", "list"] });
        },
    });
};

export const useUpdateAppearance = (courseMapId: string) => {
    const queryClient = useQueryClient();
    const detailKey = courseMapKeys.detail(courseMapId);
    return useMutation({
        mutationFn: (input: AppearanceUpdate) => courseMapApi.updateAppearance(courseMapId, input),
        onMutate: async (input) => {
            await queryClient.cancelQueries({ queryKey: detailKey });
            const previous = queryClient.getQueryData<CourseMapDetail>(detailKey);
            queryClient.setQueryData<CourseMapDetail>(detailKey, (current) => current && { ...current, ...input });
            return { previous };
        },
        onError: (_error, _input, context) => {
            if (context?.previous) queryClient.setQueryData(detailKey, context.previous);
        },
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: detailKey });
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

export const useCreateAsset = () =>
    useMutation({
        mutationFn: ({ file, kind }: { file: File; kind: AssetKind }) => courseMapApi.createAsset(file, kind),
    });

export const useCreateCourseMap = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: courseMapApi.createCourseMap,
        onSuccess: (map) => {
            queryClient.setQueryData(courseMapKeys.detail(map.id), { ...map, bubbles: [] });
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

// Optimistic: the cache is patched before the request, so a dropped or
// dragged bubble stays where the user put it. On failure only that bubble's
// previous state is restored, leaving other in-flight edits untouched.
export const useUpdateBubble = (courseMapId: string) => {
    const queryClient = useQueryClient();
    const detailKey = courseMapKeys.detail(courseMapId);
    return useMutation({
        mutationFn: ({ bubbleId, input }: { bubbleId: string; input: BubbleUpdate }) =>
            courseMapApi.updateBubble(courseMapId, bubbleId, input),
        onMutate: async ({ bubbleId, input }) => {
            await queryClient.cancelQueries({ queryKey: detailKey });
            const map = queryClient.getQueryData<CourseMapDetail>(detailKey);
            const previous = map?.bubbles.find((bubble) => bubble.id === bubbleId);
            queryClient.setQueryData<CourseMapDetail>(detailKey, (current) =>
                current && {
                    ...current,
                    bubbles: current.bubbles.map((bubble) =>
                        bubble.id === bubbleId ? { ...bubble, ...input } : bubble
                    ),
                }
            );
            return { previous };
        },
        onError: (_error, { bubbleId }, context) => {
            const previous = context?.previous;
            if (!previous) return;
            queryClient.setQueryData<CourseMapDetail>(detailKey, (current) =>
                current && {
                    ...current,
                    bubbles: current.bubbles.map((bubble) =>
                        bubble.id === bubbleId ? previous : bubble
                    ),
                }
            );
        },
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: detailKey });
        },
    });
};

export const useDeleteBubble = (courseMapId: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (bubbleId: string) => courseMapApi.deleteBubble(courseMapId, bubbleId),
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: courseMapKeys.detail(courseMapId) });
            void queryClient.invalidateQueries({ queryKey: courseMapKeys.activities(courseMapId) });
        },
    });
};
