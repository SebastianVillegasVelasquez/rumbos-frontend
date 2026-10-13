import * as RadixTooltip from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'

export const TooltipProvider = RadixTooltip.Provider

export const Tooltip = ({ content, children }: { content: ReactNode; children: ReactNode }) => (
  <RadixTooltip.Root delayDuration={200}>
    <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
    <RadixTooltip.Portal>
      <RadixTooltip.Content
        sideOffset={6}
        collisionPadding={12}
        className="z-50 max-w-[min(20rem,calc(100vw-1.5rem))] border-hair rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-white"
      >
        {content}
        <RadixTooltip.Arrow className="fill-ink" />
      </RadixTooltip.Content>
    </RadixTooltip.Portal>
  </RadixTooltip.Root>
)
