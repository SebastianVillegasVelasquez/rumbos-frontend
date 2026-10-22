import { useEffect, useRef, useState, type PointerEvent } from 'react'
import {
  ChevronDown,
  ChevronUp,
  CircleAlert,
  CircleArrowRight,
  CircleCheck,
  CircleDashed,
  Clock,
  Lock,
  MapPin,
  RotateCcw,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '../../components/ui/Button.tsx'
import { es } from '../../i18n/es.ts'
import type { ProgressCounts } from '../course-map/progress.ts'
import type { VisualState } from '../course-map/visualState.ts'
import { CORNER, GAP, GUTTER, TOUCH_TARGET } from '../hud/metrics.ts'
import { QUEST_GROUP_ORDER, type QuestEntry, type QuestGroup } from './questEntries.ts'

export const QUESTS_BUTTON_ID = 'hud-quests-button'
export const QUEST_LOG_ID = 'quest-log'
// Side panel width and the top offset that clears the HUD's top-left buttons.
export const PANEL_WIDTH = 352
export const PANEL_TOP = GUTTER + TOUCH_TARGET + GAP

// One shape per state, so nothing is told by color alone: a check, a lock, a
// pin, an arrow, a dashed circle...
const ICON: Record<VisualState, LucideIcon> = {
  next: CircleArrowRight,
  available: MapPin,
  inProgress: RotateCcw,
  complete: CircleCheck,
  locked: Lock,
  untracked: CircleDashed,
  teaser: Clock,
  missing: CircleAlert,
  unknown: CircleAlert,
}

const statusLine = (entry: QuestEntry) => {
  if (entry.group === 'next') return es.quests.status.next
  if (entry.state === 'teaser') return es.quests.status.upcoming
  if (entry.state === 'locked') return entry.info ?? es.quests.status.locked
  return es.quests.status[entry.state]
}

const SNAP_PX = 48

interface QuestLogProps {
  open: boolean
  // Narrow screens: a bottom sheet (half or full) instead of a side panel.
  compact: boolean
  // The side panel stops this far above the bottom edge, so the level chip and
  // Continuar below it stay clear.
  bottomOffset: string
  groups: Record<QuestGroup, QuestEntry[]>
  progress: ProgressCounts
  activeBubbleId: string | null
  onFocusBubble: (bubbleId: string) => void
  onOpenBubble: (bubbleId: string) => void
  onClose: () => void
  // 2D only: back to the map's starting view.
  onResetView?: () => void
}

// Misiones: the level's activities and the player's progress, as a list. It is
// also the accessible equivalent of the map, so every action the map offers is
// here: tapping a row flies the camera to the bubble, "Abrir" opens it.
export const QuestLog = ({
  open,
  compact,
  bottomOffset,
  groups,
  progress,
  activeBubbleId,
  onFocusBubble,
  onOpenBubble,
  onClose,
  onResetView,
}: QuestLogProps) => {
  const [expanded, setExpanded] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const dragStart = useRef<number | null>(null)

  // Opening moves focus into the list; closing (below) hands it back.
  useEffect(() => {
    if (open) headingRef.current?.focus()
  }, [open])

  if (!open) return null

  const close = () => {
    onClose()
    requestAnimationFrame(() => document.getElementById(QUESTS_BUTTON_ID)?.focus())
  }

  const onHandleDown = (event: PointerEvent<HTMLButtonElement>) => {
    dragStart.current = event.clientY
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onHandleUp = (event: PointerEvent<HTMLButtonElement>) => {
    const start = dragStart.current
    dragStart.current = null
    if (start === null) return
    const dy = event.clientY - start
    if (dy <= -SNAP_PX) setExpanded(true)
    else if (dy >= SNAP_PX) {
      if (expanded) setExpanded(false)
      else close()
    } else setExpanded((value) => !value)
  }

  const total = Object.values(groups).reduce((sum, list) => sum + list.length, 0)
  const summary = progress.nothingTracked
    ? es.hud.noTracking
    : progress.percent !== null
      ? es.quests.summary(progress.completed, progress.total, progress.percent)
      : null

  const placement = compact
    ? {
        left: 0,
        right: 0,
        bottom: 0,
        height: expanded ? `calc(100% - ${CORNER}px)` : '50%',
      }
    : {
        left: `max(${GUTTER}px, env(safe-area-inset-left, 0px))`,
        top: PANEL_TOP,
        bottom: bottomOffset,
        width: `min(${PANEL_WIDTH}px, calc(100% - ${2 * GUTTER}px))`,
      }

  return (
    <section
      id={QUEST_LOG_ID}
      aria-labelledby="quest-log-title"
      className={`pointer-events-auto absolute z-30 flex flex-col overflow-hidden border-soft bg-surface text-ink shadow-md ${
        compact
          ? 'rounded-t-lg motion-safe:transition-[height] motion-safe:duration-200'
          : 'rounded-lg'
      }`}
      style={placement}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          close()
        }
      }}
    >
      {compact && (
        <button
          type="button"
          onPointerDown={onHandleDown}
          onPointerUp={onHandleUp}
          onPointerCancel={() => (dragStart.current = null)}
          onClick={(event) => {
            // Enter or Space (a pointer tap is handled on pointer up).
            if (event.detail === 0) setExpanded((value) => !value)
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp') setExpanded(true)
            if (event.key === 'ArrowDown') setExpanded(false)
          }}
          aria-label={expanded ? es.quests.collapse : es.quests.expand}
          className="flex min-h-[44px] w-full shrink-0 touch-none items-center justify-center"
        >
          <span className="h-1.5 w-12 rounded-pill bg-slate" aria-hidden />
        </button>
      )}

      <header className="flex items-start justify-between gap-2 px-4 pb-2 pt-2">
        <div className="min-w-0">
          <h2
            id="quest-log-title"
            ref={headingRef}
            tabIndex={-1}
            className="font-heading text-lg font-extrabold outline-none"
          >
            {es.quests.title}
          </h2>
          {summary && <p className="text-sm font-semibold text-ink-soft">{summary}</p>}
        </div>
        <div className="flex shrink-0 gap-1">
          {compact && (
            <Button
              variant="surface"
              dense
              size="sm"
              className="min-w-[44px] px-0"
              aria-label={expanded ? es.quests.collapse : es.quests.expand}
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? (
                <ChevronDown size={18} strokeWidth={2.5} aria-hidden />
              ) : (
                <ChevronUp size={18} strokeWidth={2.5} aria-hidden />
              )}
            </Button>
          )}
          <Button
            variant="surface"
            dense
            size="sm"
            className="min-w-[44px] px-0"
            aria-label={es.quests.close}
            onClick={close}
          >
            <X size={18} strokeWidth={2.5} aria-hidden />
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2 pb-3">
        {total === 0 && (
          <p className="px-2 text-sm font-semibold text-ink-soft">{es.quests.empty}</p>
        )}
        {QUEST_GROUP_ORDER.filter((group) => groups[group].length > 0).map((group) => (
          <section key={group} aria-labelledby={`quest-group-${group}`}>
            <h3
              id={`quest-group-${group}`}
              className="px-2 pb-1 text-xs font-bold uppercase tracking-wide text-ink-soft"
            >
              {es.quests.groups[group]}
              <span className="ml-1 font-semibold normal-case">({groups[group].length})</span>
            </h3>
            <ul className="space-y-1">
              {groups[group].map((entry) => {
                const Icon = entry.group === 'next' ? ICON.next : ICON[entry.state]
                const name =
                  entry.state === 'teaser'
                    ? es.quests.upcomingName
                    : (entry.name ?? es.quests.unknownName)
                const status = statusLine(entry)
                const active = entry.bubbleId === activeBubbleId
                return (
                  <li key={entry.bubbleId} className="flex items-stretch gap-1">
                    <button
                      type="button"
                      onClick={() => onFocusBubble(entry.bubbleId)}
                      aria-current={active ? 'true' : undefined}
                      aria-label={es.quests.focusAria(name, status)}
                      className={`flex min-h-[44px] min-w-0 flex-1 items-start gap-3 rounded-md px-3 py-2 text-left hover:bg-primary-tint ${
                        active ? 'border-soft bg-primary-tint' : 'border-hair bg-surface-muted'
                      }`}
                    >
                      <Icon size={20} strokeWidth={2.5} aria-hidden className="mt-0.5 shrink-0" />
                      <span className="min-w-0">
                        <span className="block break-words text-sm font-bold">{name}</span>
                        <span className="block break-words text-xs font-semibold text-ink-soft">
                          {status}
                        </span>
                      </span>
                    </button>
                    {entry.openable && (
                      <Button
                        variant="secondary"
                        dense
                        size="sm"
                        className="shrink-0"
                        aria-label={es.quests.openAria(name)}
                        onClick={() => onOpenBubble(entry.bubbleId)}
                      >
                        {es.quests.open}
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>

      {onResetView && (
        <footer className="shrink-0 border-t-soft px-3 py-2">
          <Button variant="surface" dense size="sm" className="w-full" onClick={onResetView}>
            <RotateCcw size={16} strokeWidth={2.5} aria-hidden />
            {es.hud.resetView}
          </Button>
        </footer>
      )}
    </section>
  )
}
