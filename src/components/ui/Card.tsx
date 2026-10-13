import type { HTMLAttributes } from 'react'

// 'panel' is a first-level card (3px border + large hard shadow). 'item' is
// for cards repeated in a grid or list: soft border, no shadow, only the
// background reacts on hover.
type CardVariant = 'panel' | 'item'

const cardVariants: Record<CardVariant, string> = {
  panel: 'border-strong shadow-lg',
  item: 'border-soft transition-colors hover:bg-primary-tint',
}

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
}

export const Card = ({ variant = 'panel', className = '', ...props }: CardProps) => (
  <div className={`rounded-lg bg-surface ${cardVariants[variant]} ${className}`} {...props} />
)

type BadgeTone = 'slate' | 'sun' | 'teal' | 'leaf' | 'coral'

const badgeTones: Record<BadgeTone, string> = {
  slate: 'bg-slate-tint text-slate-dark',
  sun: 'bg-sun-tint text-sun-dark',
  teal: 'bg-primary-tint text-primary',
  leaf: 'bg-leaf-tint text-leaf-dark',
  coral: 'bg-danger-tint text-danger',
}

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
}

export const Badge = ({ tone = 'slate', className = '', ...props }: BadgeProps) => (
  <span
    className={`border-hair inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-xs font-bold ${badgeTones[tone]} ${className}`}
    {...props}
  />
)
