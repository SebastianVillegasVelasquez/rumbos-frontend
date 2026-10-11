import { useEffect, useRef, useState } from "react";
import * as RadixAlertDialog from "@radix-ui/react-alert-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "../../../components/ui/Button.tsx";
import { useToast } from "../../../components/ui/toastContext.ts";
import { es } from "../../../i18n/es.ts";
import { reloadDraft } from "../data/draftCache.ts";
import { courseMapKeys } from "../data/queryKeys.ts";
import { subscribeConflicts, subscribeIdle, type MapConflictEvent } from "../data/writeQueues.ts";

const REFRESH_DEBOUNCE_MS = 600;

// Mounted once at the app root. It is the only place that reacts to the write
// queue: it resolves version conflicts (a toast for a bubble, a dialog for the
// map) and refreshes publication state after a batch of successful writes.
export const WriteSyncHost = () => {
    const queryClient = useQueryClient();
    const toast = useToast();
    const [mapConflicts, setMapConflicts] = useState<MapConflictEvent[]>([]);
    const [working, setWorking] = useState(false);
    const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

    useEffect(() => {
        const refreshAround = (mapId: string) => {
            void queryClient.invalidateQueries({ queryKey: courseMapKeys.publicationState(mapId) });
            void queryClient.invalidateQueries({
                predicate: (query) =>
                    query.queryKey[0] === "course-maps" && (query.queryKey[1] === "list" || query.queryKey[1] === "by-course"),
            });
        };

        // Fetches the other person's version straight into the cache. If that
        // fails the cache is flagged stale so the next successful fetch heals it.
        const loadLatest = async (mapId: string) => {
            try {
                await reloadDraft(queryClient, mapId);
                return true;
            } catch {
                void queryClient.invalidateQueries({ queryKey: courseMapKeys.detail(mapId) });
                toast.show(es.conflict.reloadFailed, "error");
                return false;
            }
        };

        const offConflicts = subscribeConflicts((event) => {
            if (event.target.startsWith("bubble:")) {
                // The other person's bubble wins; the local change is dropped.
                void loadLatest(event.mapId).then((loaded) => {
                    event.discard();
                    if (loaded) toast.show(es.conflict.bubbleReloaded, "info");
                    refreshAround(event.mapId);
                });
                return;
            }
            setMapConflicts((current) => [...current, event]);
        });

        const offIdle = subscribeIdle((mapId, wrote) => {
            if (!wrote) return;
            const pending = timers.current.get(mapId);
            if (pending) clearTimeout(pending);
            timers.current.set(
                mapId,
                setTimeout(() => {
                    timers.current.delete(mapId);
                    refreshAround(mapId);
                }, REFRESH_DEBOUNCE_MS)
            );
        });

        const pendingTimers = timers.current;
        return () => {
            offConflicts();
            offIdle();
            pendingTimers.forEach((timer) => clearTimeout(timer));
            pendingTimers.clear();
        };
    }, [queryClient, toast]);

    const current = mapConflicts[0];

    const resolve = async (choice: "reload" | "mine") => {
        if (!current) return;
        setWorking(true);
        try {
            const loaded = await reloadDraft(queryClient, current.mapId).then(
                () => true,
                () => false
            );
            if (!loaded) {
                // Neither choice is safe without the other person's version
                // (re-sending needs the fresh revision), so keep the dialog.
                toast.show(es.conflict.reloadFailed, "error");
                return;
            }
            if (choice === "mine") current.retry();
            else current.discard();
            void queryClient.invalidateQueries({ queryKey: courseMapKeys.publicationState(current.mapId) });
            setMapConflicts((list) => list.slice(1));
        } finally {
            setWorking(false);
        }
    };

    return (
        <RadixAlertDialog.Root open={current !== undefined}>
            <RadixAlertDialog.Portal>
                <RadixAlertDialog.Overlay className="fixed inset-0 z-[70] bg-ink/50 backdrop-blur-sm" />
                <RadixAlertDialog.Content
                    // No dismiss shortcut: the user has to pick what happens to
                    // their change.
                    onEscapeKeyDown={(event) => event.preventDefault()}
                    className="fixed left-1/2 top-1/2 z-[71] w-[min(92vw,30rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface p-6 shadow-soft focus:outline-none"
                >
                    <RadixAlertDialog.Title className="font-heading text-lg font-semibold text-ink">
                        {es.conflict.mapTitle}
                    </RadixAlertDialog.Title>
                    <RadixAlertDialog.Description className="mt-2 text-sm text-ink-soft">
                        {current && current.droppedCount > 0
                            ? es.conflict.mapDescriptionMany(current.droppedCount + 1)
                            : es.conflict.mapDescription}
                    </RadixAlertDialog.Description>
                    <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button variant="secondary" disabled={working} onClick={() => void resolve("reload")}>
                            {es.conflict.reload}
                        </Button>
                        <Button variant="primary" disabled={working} onClick={() => void resolve("mine")}>
                            {working ? es.conflict.working : es.conflict.applyMine}
                        </Button>
                    </div>
                </RadixAlertDialog.Content>
            </RadixAlertDialog.Portal>
        </RadixAlertDialog.Root>
    );
};
