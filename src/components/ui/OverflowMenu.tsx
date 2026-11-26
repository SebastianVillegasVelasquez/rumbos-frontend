import * as RadixDropdown from '@radix-ui/react-dropdown-menu'
import { Check, Ellipsis } from 'lucide-react'
import type { ReactNode } from 'react'

export interface OverflowItem {
  label: string
  icon?: ReactNode
  onSelect: () => void
  disabled?: boolean
  destructive?: boolean
  // Why it is disabled, as a tooltip.
  hint?: string
  // A switch row: shows a check while on. The menu stays closed on select either way.
  checked?: boolean
}

interface OverflowMenuProps {
  label: string
  items: readonly OverflowItem[]
  className?: string
}

// The "⋯" menu: secondary actions that must stay reachable at any width without
// each taking a button's room. The trigger is a 40px square, the rows 44px.
export const OverflowMenu = ({ label, items, className = '' }: OverflowMenuProps) => (
  <RadixDropdown.Root>
    <RadixDropdown.Trigger asChild>
      <button
        type="button"
        aria-label={label}
        title={label}
        className={`border-soft inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface text-ink hover:bg-accent ${className}`}
      >
        <Ellipsis size={18} strokeWidth={3} aria-hidden />
      </button>
    </RadixDropdown.Trigger>
    <RadixDropdown.Portal>
      <RadixDropdown.Content
        align="end"
        sideOffset={6}
        collisionPadding={8}
        className="z-[70] min-w-[11rem] max-w-[calc(100vw-1rem)] border-soft rounded-md bg-surface p-1.5 shadow-sm focus:outline-none"
      >
        {items.map((item) => (
          <RadixDropdown.Item
            key={item.label}
            disabled={item.disabled}
            title={item.disabled ? item.hint : undefined}
            onSelect={item.onSelect}
            {...(item.checked === undefined
              ? {}
              : { role: 'menuitemcheckbox', 'aria-checked': item.checked })}
            className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-md px-3 text-sm font-bold data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 ${
              item.destructive
                ? 'text-danger data-[highlighted]:bg-danger-tint'
                : 'text-ink data-[highlighted]:bg-primary-tint'
            }`}
          >
            {item.icon}
            <span className="min-w-0 flex-1">{item.label}</span>
            {item.checked && <Check size={16} strokeWidth={3} aria-hidden />}
          </RadixDropdown.Item>
        ))}
      </RadixDropdown.Content>
    </RadixDropdown.Portal>
  </RadixDropdown.Root>
)
