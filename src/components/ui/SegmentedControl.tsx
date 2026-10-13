interface SegmentedOption<T extends string> {
  value: T
  label: string
  disabled?: boolean
  // Explains why an option is disabled (tooltip and screen-reader text).
  hint?: string
}

interface SegmentedControlProps<T extends string> {
  options: ReadonlyArray<SegmentedOption<T>>
  value: T
  onChange: (value: T) => void
  'aria-label': string
  // Stretch to the container and share its width equally between options.
  fullWidth?: boolean
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  fullWidth = false,
  ...rest
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={rest['aria-label']}
      className={`border-soft max-w-full gap-1 rounded-md bg-surface p-1 ${
        fullWidth ? 'flex w-full' : 'inline-flex flex-wrap'
      }`}
    >
      {options.map((option) => {
        const active = option.value === value
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
            className={`min-h-[44px] rounded-md px-3 text-sm sm:px-3.5 font-bold transition-colors ${
              fullWidth ? 'flex-1 px-2 text-xs leading-tight sm:text-sm' : ''
            } ${
              active
                ? 'bg-primary text-white'
                : 'text-ink-soft hover:bg-primary-tint hover:text-ink'
            } ${option.disabled ? 'cursor-not-allowed opacity-50 hover:text-ink-soft' : ''}`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
