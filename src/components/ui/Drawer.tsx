import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { es } from "../../i18n/es.ts";

interface DrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    children: ReactNode;
}

// A right-hand panel built on the same Radix dialog primitive as Dialog, so
// focus is trapped, Escape closes it and focus returns to the trigger.
export const Drawer = ({ open, onOpenChange, title, description, children }: DrawerProps) => (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
        <RadixDialog.Portal>
            <RadixDialog.Overlay className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm" />
            <RadixDialog.Content
                {...(description ? {} : { "aria-describedby": undefined })}
                className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-ink/10 bg-surface shadow-soft focus:outline-none"
            >
                <div className="flex items-start justify-between gap-4 border-b border-ink/10 px-4 py-3">
                    <div>
                        <RadixDialog.Title className="font-heading text-base font-semibold text-ink">{title}</RadixDialog.Title>
                        {description && (
                            <RadixDialog.Description className="mt-0.5 text-xs text-ink-soft">{description}</RadixDialog.Description>
                        )}
                    </div>
                    <RadixDialog.Close
                        aria-label={es.app.close}
                        className="rounded-pill p-1.5 text-ink-soft hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-dark"
                    >
                        <X size={18} />
                    </RadixDialog.Close>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
            </RadixDialog.Content>
        </RadixDialog.Portal>
    </RadixDialog.Root>
);
