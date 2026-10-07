import * as RadixDialog from "@radix-ui/react-dialog";
import { ExternalLink, X } from "lucide-react";
import type { Activity } from "../data/types.ts";
import { isSafeActivityUrl } from "../activityOpener.ts";
import { es } from "../../../i18n/es.ts";

interface ActivityModalProps {
    activity: Activity | null;
    onClose: () => void;
}

export const ActivityModal = ({ activity, onClose }: ActivityModalProps) => {
    const isOpen = activity !== null && isSafeActivityUrl(activity.url);

    return (
        <RadixDialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <RadixDialog.Portal>
                <RadixDialog.Overlay className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm" />
                <RadixDialog.Content className="fixed left-1/2 top-1/2 z-50 flex h-[80vh] w-[min(95vw,64rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg bg-surface shadow-soft focus:outline-none">
                    <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-4 py-3">
                        <RadixDialog.Title className="truncate font-heading font-semibold text-ink">
                            {activity?.name}
                        </RadixDialog.Title>
                        <div className="flex shrink-0 items-center gap-3">
                            {activity && (
                                <a
                                    href={activity.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-sm font-medium text-teal-dark hover:underline"
                                >
                                    <ExternalLink size={14} />
                                    {es.activityModal.openInNewTab}
                                </a>
                            )}
                            <RadixDialog.Close
                                aria-label={es.activityModal.close}
                                className="rounded-pill p-1.5 text-ink-soft hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-dark"
                            >
                                <X size={18} />
                            </RadixDialog.Close>
                        </div>
                    </div>
                    {activity && <iframe src={activity.url} title={activity.name} className="w-full flex-1" />}
                </RadixDialog.Content>
            </RadixDialog.Portal>
        </RadixDialog.Root>
    );
};
