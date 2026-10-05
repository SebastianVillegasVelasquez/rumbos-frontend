import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { courseMapApi } from "./index.ts";
import { ApiError } from "./client.ts";
import type { BubbleCreate, BubbleUpdate } from "./types.ts";

export const courseMapKeys = {
    all: ["course-maps"] as const,
    detail: (courseMapId: string) => ["course-maps", courseMapId, "detail"] as const,
    activities: (courseMapId: string) => ["course-maps", courseMapId, "activities"] as const,
    activitiesList: (courseMapId: string, includeHidden: boolean) =>
        [...courseMapKeys.activities(courseMapId), { includeHidden }] as const,
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

export const useCreateBubble = (courseMapId: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: BubbleCreate) => courseMapApi.createBubble(courseMapId, input),
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: courseMapKeys.detail(courseMapId) });
            void queryClient.invalidateQueries({ queryKey: courseMapKeys.activities(courseMapId) });
        },
    });
};

export const useUpdateBubble = (courseMapId: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ bubbleId, input }: { bubbleId: string; input: BubbleUpdate }) =>
            courseMapApi.updateBubble(courseMapId, bubbleId, input),
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: courseMapKeys.detail(courseMapId) });
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
