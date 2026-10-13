import { forwardRef, type ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'surface' | 'ghost' | 'danger' | 'dangerGhost'
type Size = 'sm' | 'md'

// Full neo-brutalist recipe (3px border + hard shadow) for first-level
// actions. Hover lifts, active presses; reduced-motion keeps the shadow
// change but drops the translate.
const base =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md font-bold ' +
  'transition-[transform,box-shadow,background-color] duration-100 ' +
  'disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none'

const raised =
  'border-strong shadow-md hover:shadow-md-hover active:shadow-none ' +
  'motion-safe:hover:-translate-x-0.5 motion-safe:hover:-translate-y-0.5 ' +
  'motion-safe:active:translate-x-1 motion-safe:active:translate-y-1'

const variants: Record<Variant, string> = {
  primary: `${raised} bg-primary text-white`,
  secondary: `${raised} bg-accent text-ink`,
  // White raised button, for use on accent-colored bars (the app header).
  surface: `${raised} bg-surface text-ink`,
  danger: `${raised} bg-danger text-white`,
  dangerGhost: `${raised} bg-surface text-danger`,
  // Dense zones: no border, no shadow, only the background reacts.
  ghost: 'bg-transparent text-ink-soft hover:bg-primary-tint hover:text-ink',
}

// Icon buttons live in dense zones (card corners, toolbars): soft border,
// no shadow, background-only feedback.
const iconVariants: Record<Variant, string> = {
  primary: 'border-soft bg-primary text-white hover:bg-ink',
  secondary: 'border-soft bg-surface text-ink hover:bg-accent',
  surface: 'border-soft bg-surface text-ink hover:bg-accent',
  danger: 'border-soft bg-danger text-white hover:bg-ink',
  dangerGhost: 'border-soft bg-surface text-danger hover:bg-danger-tint',
  ghost: 'bg-transparent text-ink-soft hover:bg-primary-tint hover:text-ink',
}

const sizes: Record<Size, string> = {
  sm: 'px-3 text-sm',
  md: 'px-5 text-sm',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  // Flat look (soft border, no shadow) for buttons inside popovers, panels
  // and other dense zones, where a raised button would nest shadows.
  dense?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', dense = false, className = '', ...props }, ref) => (
    <button
      ref={ref}
      className={`${base} ${dense ? iconVariants[variant] : variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  )
)
Button.displayName = 'Button'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  'aria-label': string
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ variant = 'secondary', className = '', ...props }, ref) => (
    <button
      ref={ref}
      className={`${base} ${iconVariants[variant]} h-11 w-11 min-w-[44px] ${className}`}
      {...props}
    />
  )
)
IconButton.displayName = 'IconButton'
