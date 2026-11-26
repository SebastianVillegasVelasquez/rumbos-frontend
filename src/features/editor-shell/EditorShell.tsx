import { useState, type ReactNode } from 'react'
import {
  ArrowLeft,
  ClipboardList,
  Flame,
  Layers,
  ListChecks,
  Map as MapIcon,
  Maximize2,
  Palette,
} from 'lucide-react'
import { CompassMark } from '../../components/Logo.tsx'
import { SegmentedControl } from '../../components/ui/SegmentedControl.tsx'
import { es } from '../../i18n/es.ts'
import { ScrollMemoryContext } from './scrollMemoryContext.ts'
import { createScrollMemory, keepsMapVisible, type SectionId } from './sections.ts'

const ICONS: Record<SectionId, ReactNode> = {
  map: <MapIcon size={20} strokeWidth={2.5} aria-hidden />,
  activities: <ListChecks size={20} strokeWidth={2.5} aria-hidden />,
  levels: <Layers size={20} strokeWidth={2.5} aria-hidden />,
  heat: <Flame size={20} strokeWidth={2.5} aria-hidden />,
  appearance: <Palette size={20} strokeWidth={2.5} aria-hidden />,
  summary: <ClipboardList size={20} strokeWidth={2.5} aria-hidden />,
}

export interface RailItem {
  id: SectionId
  // A count badge (the activities not yet on the map).
  badge?: number
  // A dot: something in this section is waiting (unsaved edits).
  attention?: boolean
}

type OtherSection = Exclude<SectionId, 'map'>

interface EditorShellProps {
  // Left of the bar: "Rumbos / A1".
  home?: () => void
  mapTitle?: string
  levelNav?: ReactNode
  viewMode: 'edit' | 'preview' | 'published'
  onViewModeChange: (mode: 'edit' | 'preview') => void
  // The save status, Guardar and the ⋯ menu, in that order.
  publication: ReactNode
  // Null when the host has the stage already (its own exit control is there) or
  // there is no stage to ask for.
  onFullscreen: (() => void) | null
  // Fullscreen: the host's exit control sits in the top-right corner, above the
  // app, so the bar keeps clear of it.
  reservedCorner: number | null
  items: readonly RailItem[]
  section: SectionId
  onSectionChange: (section: SectionId) => void
  // What each section shows; rendered once first opened, then kept mounted so
  // unsaved edits and scroll positions survive switching.
  sections: Partial<Record<OtherSection, ReactNode>>
  // The map editor: kept mounted at its full size while a section is open, so
  // its zoom and selection are still there on the way back.
  map: ReactNode
}

const Brand = ({ home }: { home?: () => void }) => {
  const content = (
    <>
      <CompassMark />
      <span className="font-heading text-lg font-extrabold text-ink max-[680px]:hidden">
        {es.app.wordmark}
      </span>
    </>
  )
  return home ? (
    <button
      type="button"
      onClick={home}
      aria-label={es.app.wordmark}
      className="inline-flex h-10 min-w-10 shrink-0 items-center justify-center gap-1.5 rounded-md max-[400px]:hidden"
    >
      {content}
    </button>
  ) : (
    <span className="inline-flex h-10 shrink-0 items-center gap-1.5 max-[400px]:hidden">
      {content}
    </span>
  )
}

export const EditorShell = ({
  home,
  mapTitle,
  levelNav,
  viewMode,
  onViewModeChange,
  publication,
  onFullscreen,
  reservedCorner,
  items,
  section,
  onSectionChange,
  sections,
  map,
}: EditorShellProps) => {
  const [memory] = useState(createScrollMemory)
  // Sections the editor has opened; they stay mounted from then on.
  const [opened, setOpened] = useState<ReadonlySet<SectionId>>(() => new Set([section]))
  if (!opened.has(section)) setOpened(new Set([...opened, section]))

  // Sections that leave the map on screen: Actividades is a strip beside (or, on a narrow bar,
  // under) it, so activities can still be dragged onto the map.
  const split = keepsMapVisible(section)
  const open = section !== 'map' && !split

  return (
    <ScrollMemoryContext value={memory}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header
          className="flex h-12 min-w-0 flex-none items-center gap-1.5 overflow-hidden border-b-strong bg-accent px-1.5 min-[520px]:gap-2 min-[520px]:px-3"
          style={
            reservedCorner
              ? { paddingRight: reservedCorner, height: Math.max(48, reservedCorner) }
              : undefined
          }
        >
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <Brand home={home} />
            {mapTitle && (
              <>
                <span aria-hidden className="shrink-0 text-ink max-[680px]:hidden">
                  /
                </span>
                <span
                  className="min-w-0 truncate text-sm font-bold text-ink max-[400px]:hidden"
                  title={mapTitle}
                >
                  {mapTitle}
                </span>
              </>
            )}
            {levelNav}
          </div>

          <div className="flex-none [&>div]:flex-nowrap [&>div]:gap-0.5 [&>div]:p-0.5 [&_button]:min-h-[40px] [&_button]:px-1.5 [&_button]:text-xs min-[520px]:[&_button]:px-3 min-[520px]:[&_button]:text-sm">
            <SegmentedControl
              aria-label={es.shell.mode}
              value={viewMode === 'preview' ? 'preview' : 'edit'}
              onChange={onViewModeChange}
              options={[
                { value: 'edit', label: es.shell.modeEdit },
                { value: 'preview', label: es.shell.modePreview },
              ]}
            />
          </div>
          <div className="flex shrink-0 items-center gap-1.5 min-[520px]:gap-2">{publication}</div>
          {onFullscreen && (
            <button
              type="button"
              onClick={onFullscreen}
              aria-label={es.shell.fullscreen}
              title={es.shell.fullscreen}
              className="border-soft inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface text-ink hover:bg-accent"
            >
              <Maximize2 size={18} strokeWidth={2.5} aria-hidden />
            </button>
          )}
        </header>

        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <nav
            aria-label={es.shell.rail}
            className="flex w-16 flex-none flex-col gap-1 overflow-y-auto overflow-x-hidden border-r-strong bg-surface p-0.5 max-[520px]:w-12"
          >
            {items.map((item) => {
              const active = item.id === section
              const label = es.shell.sections[item.id]
              const hint = item.badge
                ? `${label} (${item.badge})`
                : item.attention
                  ? `${label}: ${es.shell.unsaved}`
                  : label
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  aria-label={hint}
                  title={hint}
                  onClick={() => onSectionChange(item.id)}
                  className={`relative flex min-h-[48px] w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-md px-0.5 py-1 transition-colors ${
                    active
                      ? 'border-soft bg-primary-tint text-primary'
                      : 'text-ink-soft hover:bg-primary-tint hover:text-ink'
                  }`}
                >
                  {ICONS[item.id]}
                  <span className="w-full overflow-hidden text-center text-[9px] font-bold leading-[1.15] tracking-tight max-[520px]:sr-only">
                    {label}
                  </span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-md bg-primary px-1 text-[10px] font-bold text-white">
                      {item.badge}
                    </span>
                  )}
                  {item.attention && (
                    <span
                      aria-hidden
                      className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border border-surface bg-sun-dark"
                    />
                  )}
                </button>
              )
            })}
          </nav>

          <div
            className={`relative min-h-0 min-w-0 flex-1 overflow-hidden ${
              split ? 'flex flex-row max-[520px]:flex-col' : ''
            }`}
          >
            <div
              className={`flex min-w-0 flex-col overflow-hidden ${
                split ? 'relative min-h-0 flex-1' : 'absolute inset-0'
              } ${open ? 'pointer-events-none invisible' : ''}`}
              inert={open}
            >
              {map}
            </div>
            {(Object.keys(sections) as OtherSection[])
              .filter((id) => opened.has(id))
              .map((id) => (
                <section
                  key={id}
                  aria-label={es.shell.sections[id]}
                  hidden={section !== id}
                  className={`z-10 flex min-w-0 flex-col overflow-hidden bg-surface ${
                    id === 'activities'
                      ? 'relative order-first w-60 flex-none border-r-strong max-[520px]:order-last max-[520px]:h-[45%] max-[520px]:w-full max-[520px]:border-t-strong max-[520px]:border-r-0'
                      : 'absolute inset-0'
                  }`}
                >
                  <div className="flex min-h-[48px] flex-none items-center gap-2 border-b-soft px-2 min-[520px]:px-3">
                    <h2 className="min-w-0 flex-1 truncate font-heading text-base font-extrabold text-ink">
                      {es.shell.sections[id]}
                    </h2>
                    <button
                      type="button"
                      onClick={() => onSectionChange('map')}
                      aria-label={es.shell.backToMap}
                      className="border-soft inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-md bg-surface px-2.5 text-sm font-bold text-ink hover:bg-accent"
                    >
                      <ArrowLeft size={16} strokeWidth={3} aria-hidden />
                      <span className="max-[400px]:hidden">{es.shell.backToMap}</span>
                    </button>
                  </div>
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                    {sections[id]}
                  </div>
                </section>
              ))}
          </div>
        </div>
      </div>
    </ScrollMemoryContext>
  )
}
