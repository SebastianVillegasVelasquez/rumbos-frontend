interface SegmentedOption<T extends string> {
    value: T;
    label: string;
    disabled?: boolean;
    // Explains why an option is disabled (tooltip and screen-reader text).
    hint?: string;
}

interface SegmentedControlProps<T extends string> {
    options: ReadonlyArray<SegmentedOption<T>>;
    value: T;
    onChange: (value: T) => void;
    "aria-label": string;
}

export function SegmentedControl<T extends string>({
    options,
    value,
    onChange,
    ...rest
}: SegmentedControlProps<T>) {
    return (
        <div
            role="radiogroup"
            aria-label={rest["aria-label"]}
            className="inline-flex rounded-pill bg-surface-muted p-1"
        >
            {options.map((option) => {
                const active = option.value === value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-disabled={option.disabled || undefined}
                        disabled={option.disabled}
                        title={option.disabled ? option.hint : undefined}
                        onClick={() => onChange(option.value)}
                        className={`min-h-[36px] rounded-pill px-3.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-dark ${
                            active ? "bg-teal-dark text-white shadow-soft" : "text-ink-soft hover:text-ink"
                        } ${
                            option.disabled ? "cursor-not-allowed opacity-50 hover:text-ink-soft" : ""
                        }`}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}
