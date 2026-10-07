import * as RadixTooltip from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

export const TooltipProvider = RadixTooltip.Provider;

export const Tooltip = ({ content, children }: { content: ReactNode; children: ReactNode }) => (
    <RadixTooltip.Root delayDuration={200}>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
            <RadixTooltip.Content
                sideOffset={6}
                className="z-50 max-w-xs rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-white shadow-soft"
            >
                {content}
                <RadixTooltip.Arrow className="fill-ink" />
            </RadixTooltip.Content>
        </RadixTooltip.Portal>
    </RadixTooltip.Root>
);
