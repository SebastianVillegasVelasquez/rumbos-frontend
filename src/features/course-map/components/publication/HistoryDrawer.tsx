import { useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { Badge } from "../../../../components/ui/Card.tsx";
import { Button } from "../../../../components/ui/Button.tsx";
import { ConfirmDialog } from "../../../../components/ui/ConfirmDialog.tsx";
import { Drawer } from "../../../../components/ui/Drawer.tsx";
import { useToast } from "../../../../components/ui/toastContext.ts";
import { es } from "../../../../i18n/es.ts";
import { useRestorePublication } from "../../data/draftMutations.ts";
import { isWriteDiscarded } from "../../data/writeQueue.ts";
import { usePublications } from "../../data/queries.ts";
import type { PublicationSummary, Warning } from "../../data/types.ts";

interface HistoryDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    courseMapId: string;
    currentNumber: number | null;
    onWarnings: (warnings: Warning[]) => void;
}

const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("es", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

// Lists every publication, newest first. Restoring replaces the DRAFT only: it
// never publishes, which the confirmation says in so many words.
export const HistoryDrawer = ({ open, onOpenChange, courseMapId, currentNumber, onWarnings }: HistoryDrawerProps) => {
    const toast = useToast();
    const publications = usePublications(courseMapId, open);
    const restore = useRestorePublication(courseMapId);
    const [target, setTarget] = useState<PublicationSummary | null>(null);

    const handleRestore = (publication: PublicationSummary) => {
        restore.mutate(publication.number, {
            onSuccess: (result) => {
                toast.show(es.publication.history.restored(publication.number), "success");
                if (result.warnings.length > 0) onWarnings(result.warnings);
                onOpenChange(false);
            },
            onError: (error) => {
                if (!isWriteDiscarded(error)) toast.show(es.publication.history.restoreError, "error");
            },
        });
    };

    return (
        <>
            <Drawer open={open} onOpenChange={onOpenChange} title={es.publication.history.title} description={es.publication.history.description}>
                {publications.isPending && (
                    <p className="flex items-center gap-2 text-sm text-ink-soft" role="status">
                        <Loader2 size={15} className="animate-spin" />
                        {es.publication.dialog.loading}
                    </p>
                )}
                {publications.isError && (
                    <div className="space-y-2" role="alert">
                        <p className="text-sm text-coral-dark">{es.publication.history.loadError}</p>
                        <Button size="sm" variant="secondary" onClick={() => void publications.refetch()}>
                            {es.publication.dialog.retry}
                        </Button>
                    </div>
                )}
                {publications.data && publications.data.items.length === 0 && (
                    <p className="text-sm text-ink-soft">{es.publication.history.empty}</p>
                )}
                {publications.data && publications.data.items.length > 0 && (
                    <ol className="space-y-3">
                        {publications.data.items.map((publication) => (
                            <li key={publication.number} className="space-y-2 rounded-lg border border-ink/10 p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="font-heading text-sm font-semibold text-ink">{es.publication.history.version(publication.number)}</p>
                                    {publication.number === currentNumber && <Badge tone="leaf">{es.publication.history.current}</Badge>}
                                </div>
                                <p className="text-xs text-ink-soft">
                                    <time dateTime={publication.createdAt}>{formatDate(publication.createdAt)}</time> ·{" "}
                                    {es.publication.history.bubbles(publication.bubbleCount)}
                                </p>
                                <p className="truncate text-sm text-ink" title={publication.title}>
                                    {publication.title}
                                </p>
                                <p className={`text-sm ${publication.note ? "text-ink" : "italic text-ink-soft"}`}>
                                    {publication.note ?? es.publication.history.noNote}
                                </p>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    disabled={restore.isPending}
                                    onClick={() => setTarget(publication)}
                                    aria-label={`${es.publication.history.restore}: ${es.publication.history.version(publication.number)}`}
                                >
                                    <RotateCcw size={13} />
                                    {es.publication.history.restore}
                                </Button>
                            </li>
                        ))}
                    </ol>
                )}
            </Drawer>

            <ConfirmDialog
                open={target !== null}
                onOpenChange={(next) => !next && setTarget(null)}
                title={es.publication.history.restoreConfirm.title}
                description={target ? es.publication.history.restoreConfirm.description(target.number) : ""}
                confirmLabel={es.publication.history.restoreConfirm.confirm}
                cancelLabel={es.publication.history.restoreConfirm.cancel}
                destructive={false}
                onConfirm={() => target && handleRestore(target)}
            />
        </>
    );
};
