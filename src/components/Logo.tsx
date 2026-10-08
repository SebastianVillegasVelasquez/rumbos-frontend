// Original mark: a simple compass rose built from a circle, two crossed
// diamonds (the needle) and four tick marks, drawn to read at 24-40px.
export const CompassMark = ({ size = 28, className = "" }: { size?: number; className?: string }) => (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
        <circle cx="16" cy="16" r="14" className="fill-sun" />
        <circle cx="16" cy="16" r="14" className="fill-none stroke-ink/10" strokeWidth="1" />
        {[0, 90, 180, 270].map((angle) => (
            <rect key={angle} x="15.25" y="2.5" width="1.5" height="3" rx="0.75" className="fill-ink/40" transform={`rotate(${angle} 16 16)`} />
        ))}
        <path d="M16 7 L20 16 L16 25 L12 16 Z" className="fill-teal-dark" />
        <path d="M16 7 L20 16 L16 16 Z" className="fill-coral-dark" />
        <circle cx="16" cy="16" r="2" className="fill-surface" />
    </svg>
);

export const Wordmark = ({ className = "" }: { className?: string }) => (
    <span className={`inline-flex items-center gap-2 ${className}`}>
        <CompassMark />
        <span className="font-heading text-lg font-semibold tracking-tight text-ink">Rumbos</span>
    </span>
);
