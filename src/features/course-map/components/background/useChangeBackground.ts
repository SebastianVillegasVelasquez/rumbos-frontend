import { useCallback } from "react";
import { useToast } from "../../../../components/ui/toastContext.ts";
import { es } from "../../../../i18n/es.ts";
import { useUpdateCourseMap } from "../../data/draftMutations.ts";
import { isWriteDiscarded } from "../../data/writeQueue.ts";
import { applyBackgroundErrorMessage } from "./assetMessages.ts";

const UNDO_WINDOW_MS = 10_000;

export type ChangeBackgroundResult = { ok: true } | { ok: false; message: string | null };

// Replaces a level's background through the guarded write queue and offers a
// ten-second undo. Undo is simply another guarded change back to the previous
// image; the previous image is never deleted, so it always exists.
export const useChangeBackground = (courseMapId: string) => {
    const toast = useToast();
    const updateMap = useUpdateCourseMap();
    const { mutateAsync } = updateMap;

    return useCallback(
        async (nextUrl: string, previousUrl: string): Promise<ChangeBackgroundResult> => {
            try {
                await mutateAsync({ courseMapId, input: { imageUrl: nextUrl } });
            } catch (error) {
                // A discarded write was already explained by the conflict UI.
                return { ok: false, message: isWriteDiscarded(error) ? null : applyBackgroundErrorMessage(error) };
            }
            toast.show(es.background.applied, "success", {
                durationMs: UNDO_WINDOW_MS,
                action: {
                    label: es.background.undo,
                    onClick: () => {
                        mutateAsync({ courseMapId, input: { imageUrl: previousUrl } }).then(
                            () => toast.show(es.background.undone, "info"),
                            (error) => {
                                if (!isWriteDiscarded(error)) toast.show(applyBackgroundErrorMessage(error), "error");
                            }
                        );
                    },
                },
            });
            return { ok: true };
        },
        [courseMapId, mutateAsync, toast]
    );
};
