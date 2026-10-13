export const Skeleton = ({ className = '' }: { className?: string }) => (
  <div
    className={`animate-pulse rounded-md bg-surface-muted motion-reduce:animate-none ${className}`}
  />
)

export const ProgressBar = ({ value, max = 100 }: { value: number; max?: number }) => {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className="h-2.5 w-full overflow-hidden rounded-md border-hair bg-surface"
    >
      <div
        className="h-full rounded-md bg-leaf-dark transition-[width] duration-500"
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

// Decorative route: start dot, stop, dotted path and destination pin.
const RouteIllustration = () => (
  <svg
    width="128"
    height="64"
    viewBox="0 0 128 64"
    fill="none"
    aria-hidden="true"
    className="h-auto w-32 max-w-full"
  >
    <path
      d="M16 52 C34 50 38 26 56 28 C72 30 78 46 98 38"
      className="stroke-ink"
      strokeWidth="3"
      strokeLinecap="round"
      strokeDasharray="1 8"
    />
    <circle cx="14" cy="52" r="8" className="fill-primary stroke-ink" strokeWidth="3" />
    <circle cx="58" cy="28" r="7" className="fill-pop stroke-ink" strokeWidth="3" />
    <path
      d="M106 6 C96 6 90 13 90 21 C90 31 106 46 106 46 C106 46 122 31 122 21 C122 13 116 6 106 6 Z"
      className="fill-accent stroke-ink"
      strokeWidth="3"
      strokeLinejoin="round"
    />
    <circle cx="106" cy="21" r="4" className="fill-ink" />
  </svg>
)

// Small compass tag pinned to the card corner (decorative).
const CompassTag = () => (
  <span
    aria-hidden="true"
    className="border-strong absolute -left-2 -top-5 sm:-left-5 flex h-12 w-12 items-center justify-center rounded-pill bg-pop"
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3 L16 12 L12 21 L8 12 Z"
        className="fill-surface stroke-ink"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="1.5" className="fill-ink" />
    </svg>
  </span>
)

export const EmptyState = ({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}) => (
  <div className="border-strong relative flex flex-col items-center gap-3 rounded-lg bg-surface p-6 sm:p-10 text-center shadow-lg">
    <CompassTag />
    {icon ? <div className="text-primary">{icon}</div> : <RouteIllustration />}
    <p className="font-heading text-xl font-extrabold text-ink">{title}</p>
    {description && (
      <p className="max-w-sm text-balance text-sm font-medium text-ink-soft">{description}</p>
    )}
    {action}
  </div>
)
