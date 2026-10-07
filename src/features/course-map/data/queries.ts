import { useInfiniteQuery, useMutation, useMutationState, useQuery, useQueryClient } from "@tanstack/react-query";
import { courseMapApi } from "./index.ts";
import { ApiError } from "./client.ts";
import type { BubbleCreate, BubbleUpdate, CourseMapDetail, CourseMapPatch } from "./types.ts";

const LIST_PAGE_SIZE = 24;

export const courseMapKeys = {
    list: (params: { q: string; moodleCourseId?: number }) => ["course-maps", "list", params] as const,
    detail: (courseMapId: string) => ["course-maps", courseMapId, "detail"] as const,
    resolved: (courseMapId: string, includeHidden: boolean) =>
        ["course-maps", courseMapId, "resolved", { includeHidden }] as const,
    activities: (courseMapId: string) => ["course-maps", courseMapId, "activities"] as const,
    activitiesList: (courseMapId: string, includeHidden: boolean) =>
        [...courseMapKeys.activities(courseMapId), { includeHidden }] as const,
    createBubble: (courseMapId: string) => ["course-maps", courseMapId, "create-bubble"] as const,
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

export const useActivities = (courseMapId: string | null, includeHidden: boolean) =>
    useQuery({
        queryKey: courseMapKeys.activitiesList(courseMapId ?? "", includeHidden),
        queryFn: () => courseMapApi.getActivities(courseMapId!, includeHidden),
        enabled: courseMapId !== null,
        retry: retryTransient,
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
