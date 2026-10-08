import * as RadixAlertDialog from "@radix-ui/react-alert-dialog";
import { Button } from "./Button.tsx";

interface ConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel: string;
    onConfirm: () => void;
    destructive?: boolean;
}

export const ConfirmDialog = ({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel,
    cancelLabel,
    onConfirm,
    destructive = true,
}: ConfirmDialogProps) => (
    <RadixAlertDialog.Root open={open} onOpenChange={onOpenChange}>
        <RadixAlertDialog.Portal>
            <RadixAlertDialog.Overlay className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm" />
            <RadixAlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(90vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface p-6 shadow-soft focus:outline-none">
                <RadixAlertDialog.Title className="font-heading text-lg font-semibold text-ink">
                    {title}
                </RadixAlertDialog.Title>
                <RadixAlertDialog.Description className="mt-2 text-sm text-ink-soft">
                    {description}
                </RadixAlertDialog.Description>
                <div className="mt-6 flex justify-end gap-2">
                    <RadixAlertDialog.Cancel asChild>
                        <Button variant="secondary">{cancelLabel}</Button>
                    </RadixAlertDialog.Cancel>
                    <RadixAlertDialog.Action asChild>
                        <Button variant={destructive ? "danger" : "primary"} onClick={onConfirm}>
                            {confirmLabel}
                        </Button>
                    </RadixAlertDialog.Action>
                </div>
            </RadixAlertDialog.Content>
        </RadixAlertDialog.Portal>
    </RadixAlertDialog.Root>
);
