import { useId, type ReactNode } from 'react'
import { Select } from '../../components/ui/Select.tsx'
import { es } from '../../i18n/es.ts'
import { ScrollRegion } from './ScrollRegion.tsx'

export interface SubNavItem<T extends string> {
  id: T
  label: string
}

interface SubNavLayoutProps<T extends string> {
  items: readonly SubNavItem<T>[]
  value: T
  onChange: (id: T) => void
  // Prefix of the remembered scroll position; the active item completes it.
  memoryScope: string
  // Whether this section is the visible one.
  active?: boolean
  // Fixed under the scrolling content (a save bar, a status line).
  footer?: ReactNode
  children: ReactNode
}

// Two columns: a vertical list about 150px wide, content on the right. Below
// about 520px the list becomes a dropdown over the content. Only the content
// scrolls, and only vertically.
export function SubNavLayout<T extends string>({
  items,
  value,
  onChange,
  memoryScope,
  active = true,
  footer,
  children,
}: SubNavLayoutProps<T>) {
  const selectId = useId()
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden min-[520px]:flex-row">
      <nav
        aria-label={es.shell.subnav}
        className="hidden w-[150px] shrink-0 overflow-y-auto overflow-x-hidden border-r-soft bg-surface-muted p-2 min-[520px]:block"
      >
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                aria-current={item.id === value ? 'page' : undefined}
                onClick={() => onChange(item.id)}
                className={`flex min-h-[40px] w-full min-w-0 items-center rounded-md px-2.5 text-left text-xs leading-tight transition-colors ${
                  item.id === value
                    ? 'border-soft bg-primary font-extrabold text-white'
                    : 'font-bold text-ink-soft hover:bg-primary-tint hover:text-ink'
                }`}
              >
                <span className="min-w-0 truncate">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-b-soft bg-surface-muted p-2 min-[520px]:hidden">
        <label htmlFor={selectId} className="sr-only">
          {es.shell.subnav}
        </label>
        <Select id={selectId} value={value} onChange={(e) => onChange(e.target.value as T)}>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <ScrollRegion memoryKey={`${memoryScope}:${value}`} active={active} className="p-3 sm:p-4">
          {children}
        </ScrollRegion>
        {footer}
      </div>
    </div>
  )
}
