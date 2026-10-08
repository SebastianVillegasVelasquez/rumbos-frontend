export const Skeleton = ({ className = "" }: { className?: string }) => (
    <div className={`animate-pulse rounded-md bg-surface-muted motion-reduce:animate-none ${className}`} />
);

export const ProgressBar = ({ value, max = 100 }: { value: number; max?: number }) => {
    const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
    return (
        <div
            role="progressbar"
            aria-valuenow={value}
            aria-valuemin={0}
            aria-valuemax={max}
            className="h-2.5 w-full overflow-hidden rounded-pill bg-surface-muted"
        >
            <div
                className="h-full rounded-pill bg-leaf-dark transition-[width] duration-500"
                style={{ width: `${percent}%` }}
            />
        </div>
    );
};

export const EmptyState = ({
    icon,
    title,
    description,
    action,
}: {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    action?: React.ReactNode;
}) => (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-ink/10 bg-surface-muted/60 p-10 text-center">
        {icon && <div className="text-teal-dark">{icon}</div>}
        <p className="font-heading text-lg font-semibold text-ink">{title}</p>
        {description && <p className="max-w-sm text-sm text-ink-soft">{description}</p>}
        {action}
    </div>
);
