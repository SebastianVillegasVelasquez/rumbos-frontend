import { forwardRef, type InputHTMLAttributes } from 'react'

// 'default' is a first-level field (3px border + hard shadow). 'compact' is
// for fields inside a modal, panel or toolbar, where a thick bordered box
// already surrounds them: soft border, no shadow.
type Density = 'default' | 'compact'

const densities: Record<Density, string> = {
  default: 'border-strong shadow-md',
  compact: 'border-soft',
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  density?: Density
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ density = 'default', className = '', ...props }, ref) => (
    <input
      ref={ref}
      className={`min-h-[44px] w-full rounded-md bg-surface px-3 text-sm font-semibold text-ink placeholder:font-medium placeholder:text-slate-dark disabled:opacity-50 ${densities[density]} ${className}`}
      {...props}
    />
  )
)
Input.displayName = 'Input'
