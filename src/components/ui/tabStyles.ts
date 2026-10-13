// Underline tabs for dialogs and panels. Only the look is shared; each
// caller keeps its own tablist markup so keyboard handling and aria wiring
// stay with the view that owns the tabs.
export const tabListClass = 'border-b-soft flex gap-1 overflow-x-auto'

export const tabClass = (active: boolean) =>
  `-mb-[2px] min-h-[44px] shrink-0 rounded-t-md px-1.5 text-xs sm:px-4 sm:text-sm ${
    active
      ? 'border-b-strong bg-primary-tint font-extrabold text-primary'
      : 'border-b-[3px] border-b-transparent font-bold text-ink-soft hover:bg-primary-tint hover:text-ink'
  }`
