import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

interface DialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    children: ReactNode;
    footer?: ReactNode;
}

export const Dialog = ({ open, onOpenChange, title, description, children, footer }: DialogProps) => (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
        <RadixDialog.Portal>
            <RadixDialog.Overlay className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm" />
            <RadixDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(90vw,32rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface p-6 shadow-soft focus:outline-none">
                <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                        <RadixDialog.Title className="font-heading text-lg font-semibold text-ink">
                            {title}
                        </RadixDialog.Title>
                        {description && (
                            <RadixDialog.Description className="mt-1 text-sm text-ink-soft">
                                {description}
                            </RadixDialog.Description>
                        )}
                    </div>
                    <RadixDialog.Close
                        aria-label="Cerrar"
                        className="rounded-pill p-1.5 text-ink-soft hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-dark"
                    >
                        <X size={18} />
                    </RadixDialog.Close>
                </div>
                {children}
                {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
            </RadixDialog.Content>
        </RadixDialog.Portal>
    </RadixDialog.Root>
);
