import { forwardRef, type SelectHTMLAttributes } from 'react'

// Native select styled like Input density="compact": soft border, no shadow.
// For fields inside modals, panels and toolbars.
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = '', ...props }, ref) => (
    <select
      ref={ref}
      className={`border-soft min-h-[44px] w-full rounded-md bg-surface px-2 text-sm font-semibold text-ink disabled:opacity-50 ${className}`}
      {...props}
    />
  )
)
Select.displayName = 'Select'
