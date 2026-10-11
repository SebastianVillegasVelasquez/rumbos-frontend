import { Suspense, lazy, useState } from "react";
import { History, Rocket, Undo2 } from "lucide-react";
import { Button } from "../../../../components/ui/Button.tsx";
import { ConfirmDialog } from "../../../../components/ui/ConfirmDialog.tsx";
import { useToast } from "../../../../components/ui/toastContext.ts";
import { es } from "../../../../i18n/es.ts";
import { useDiscardChanges } from "../../data/draftMutations.ts";
import { usePublicationState } from "../../data/queries.ts";
import { isWriteDiscarded } from "../../data/writeQueue.ts";
import type { Warning } from "../../data/types.ts";
import { PublicationChip } from "./PublicationChip.tsx";
import { PublishDialog } from "./PublishDialog.tsx";
import { WarningsDialog } from "./WarningsDialog.tsx";

// The drawer is only needed once someone opens the history.
const HistoryDrawer = lazy(() => import("./HistoryDrawer.tsx").then((m) => ({ default: m.HistoryDrawer })));

interface PublicationBarProps {
    courseMapId: string;
}

// Editor-only strip under the header: the status chip plus Publicar, Historial
// and Descartar cambios.
export const PublicationBar = ({ courseMapId }: PublicationBarProps) => {
    const toast = useToast();
    const stateQuery = usePublicationState(courseMapId);
    const discard = useDiscardChanges(courseMapId);
    const [publishOpen, setPublishOpen] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [discardOpen, setDiscardOpen] = useState(false);
    const [warnings, setWarnings] = useState<Warning[]>([]);

    const state = stateQuery.data;
    const status = state?.status ?? null;
    const discardDisabledReason =
        status === "never_published"
            ? es.publication.discard.disabledNever
            : status === "up_to_date"
              ? es.publication.discard.disabledUpToDate
              : null;
    const canDiscard = status === "unpublished_changes";
    const canPublish = status !== "up_to_date";

    const handleDiscard = () => {
        discard.mutate(undefined, {
            onSuccess: (result) => {
                toast.show(es.publication.discard.done, "success");
                if (result.warnings.length > 0) setWarnings(result.warnings);
            },
            onError: (error) => {
                if (!isWriteDiscarded(error)) toast.show(es.publication.discard.error, "error");
            },
        });
    };

    return (
        <div
            role="toolbar"
            aria-label={es.publication.publish}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-ink/10 bg-surface-muted px-4 py-2 sm:px-6"
        >
            <PublicationChip status={status} number={state?.currentNumber ?? null} />

            <div className="ml-auto flex flex-wrap items-center gap-2">
                {discardDisabledReason && (
                    <span id="discard-reason" className="hidden text-xs text-ink-soft lg:inline">
                        {discardDisabledReason}
                    </span>
                )}
                <Button type="button" size="sm" variant="ghost" onClick={() => setHistoryOpen(true)}>
                    <History size={14} />
                    {es.publication.history.button}
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={!canDiscard || discard.isPending}
                    title={discardDisabledReason ?? undefined}
                    aria-describedby={discardDisabledReason ? "discard-reason" : undefined}
                    onClick={() => setDiscardOpen(true)}
                >
                    <Undo2 size={14} />
                    {es.publication.discard.button}
                </Button>
                <Button
                    type="button"
                    size="sm"
                    disabled={!canPublish}
                    title={!canPublish ? es.publication.publishDisabled : undefined}
                    onClick={() => setPublishOpen(true)}
                >
                    <Rocket size={14} />
                    {es.publication.publish}
                </Button>
            </div>

            {/* Mounted only while open so each opening re-reviews the draft. */}
            {publishOpen && <PublishDialog open onOpenChange={setPublishOpen} courseMapId={courseMapId} />}

            {historyOpen && (
                <Suspense fallback={null}>
                    <HistoryDrawer
                        open
                        onOpenChange={setHistoryOpen}
                        courseMapId={courseMapId}
                        currentNumber={state?.currentNumber ?? null}
                        onWarnings={setWarnings}
                    />
                </Suspense>
            )}

            <ConfirmDialog
                open={discardOpen}
                onOpenChange={setDiscardOpen}
                title={es.publication.discard.title}
                description={es.publication.discard.description(state?.currentNumber ?? null)}
                confirmLabel={es.publication.discard.confirm}
                cancelLabel={es.publication.discard.cancel}
                onConfirm={handleDiscard}
            />

            <WarningsDialog warnings={warnings} onClose={() => setWarnings([])} />
        </div>
    );
};
