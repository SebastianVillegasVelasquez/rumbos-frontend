import * as RadixPopover from "@radix-ui/react-popover";
import type { ReactNode } from "react";

export const Popover = ({
    open,
    onOpenChange,
    trigger,
    children,
    align = "center",
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    trigger: ReactNode;
    children: ReactNode;
    align?: "start" | "center" | "end";
}) => (
    <RadixPopover.Root open={open} onOpenChange={onOpenChange}>
        <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
        <RadixPopover.Portal>
            <RadixPopover.Content
                align={align}
                sideOffset={8}
                className="z-50 rounded-lg bg-surface p-3 shadow-soft focus:outline-none"
            >
                {children}
                <RadixPopover.Arrow className="fill-surface" />
            </RadixPopover.Content>
        </RadixPopover.Portal>
    </RadixPopover.Root>
);
