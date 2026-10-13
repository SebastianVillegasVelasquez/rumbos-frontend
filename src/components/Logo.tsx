// Original mark: a compass built from an outlined circle and a needle
// diamond, drawn with rounded strokes to read at 24-40px.
export const CompassMark = ({
  size = 28,
  className = '',
}: {
  size?: number
  className?: string
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    className={className}
    aria-hidden="true"
  >
    <circle cx="16" cy="16" r="13.5" className="fill-surface stroke-ink" strokeWidth="2.5" />
    <path
      d="M16 7 L20 16 L16 25 L12 16 Z"
      className="fill-ink stroke-ink"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <circle cx="16" cy="16" r="2" className="fill-surface" />
  </svg>
)

// `collapsible` hides the text on very narrow screens (the mark stays); the
// parent button must then carry an aria-label.
export const Wordmark = ({
  className = '',
  collapsible = false,
}: {
  className?: string
  collapsible?: boolean
}) => (
  <span className={`inline-flex items-center gap-2 ${className}`}>
    <CompassMark />
    <span
      className={`font-heading text-xl font-extrabold text-ink ${
        collapsible ? 'hidden min-[400px]:inline' : ''
      }`}
    >
      Rumbos
    </span>
  </span>
)
