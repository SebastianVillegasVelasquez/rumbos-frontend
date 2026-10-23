import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ExternalLink, Pencil, Trash2, TriangleAlert } from 'lucide-react'
import { Button } from '../../../components/ui/Button.tsx'
import { ICON_DATA_URIS_LIGHT, ICON_KEYS, ICON_LABELS, type IconKey } from '../icons.ts'
import type { Activity, Availability, BubbleStatus, Skin } from '../data/types.ts'
import { isSafeActivityUrl } from '../activityOpener.ts'
import { es } from '../../../i18n/es.ts'
import { Badge } from '../../../components/ui/Card.tsx'
import { useEmbed } from '../../embed/EmbedContext.ts'

interface IconPickerPopoverProps {
  x: number // content-space pixels (design-space * current scale)
  y: number // content-space pixels (design-space * current scale)
  currentIcon?: IconKey
  currentStatus: BubbleStatus
  availability?: Availability
  resolvedActivity?: Activity | null
  onSelect: (icon: IconKey) => void
  onStatusSelect: (status: BubbleStatus) => void
  onDelete: () => void
  onClose: () => void
  // Per-bubble skin override - "apply to this bubble" / "clear override"
  // from the appearance studio's skin gallery happen here, in context,
  // rather than requiring a separate canvas-selection concept in the
  // studio itself.
  skins?: Skin[]
  currentSkinId?: string | null
  onSkinSelect?: (skinId: string | null) => void
  // Moodle does not track this activity's completion (embed editor).
  untracked?: boolean
  // Present only when the host can open the activity's settings (v5.4).
  onConfigureCompletion?: () => void
  // A content bubble: edited here, and no Moodle completion or status to set.
  onEditContent?: () => void
}

const STATUS_OPTIONS: { value: BubbleStatus; label: string }[] = [
  { value: 'locked', label: es.bubble.statusLabels.locked },
  { value: 'no_complete', label: es.bubble.statusLabels.no_complete },
  { value: 'in_progress', label: es.bubble.statusLabels.in_progress },
  { value: 'complete', label: es.bubble.statusLabels.complete },
]

// Positioned as a sibling of the Stage inside the same scrollable container,
// using content-space coordinates - it scrolls/stays anchored to the bubble
// automatically as the user pans, with no scroll-tracking code needed.
export const IconPickerPopover = ({
  x,
  y,
  currentIcon,
  currentStatus,
  availability,
  resolvedActivity,
  onSelect,
  onStatusSelect,
  onDelete,
  onClose,
  skins,
  currentSkinId,
  onSkinSelect,
  untracked = false,
  onConfigureCompletion,
  onEditContent,
}: IconPickerPopoverProps) => {
  const embed = useEmbed()
  const popoverRef = useRef<HTMLDivElement>(null)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return (
    <div
      ref={popoverRef}
      role="menu"
      aria-label={es.bubble.demoStatusLabel}
      className="border-soft absolute z-20 max-h-[calc(100%-1rem)] w-56 max-w-[calc(100%-0.5rem)] [translate:-50%_max(calc(-100%_-_16px),calc(8px_-_var(--popover-y)))] space-y-3 overflow-y-auto rounded-lg bg-surface p-3 shadow-sm"
      // Presentation clamp only: keep the popover inside the canvas box (x/y stay
      // the bubble's content-space position).
      style={
        {
          left: `clamp(7.25rem, ${x}px, calc(100% - 7.25rem))`,
          top: y,
          '--popover-y': `${y}px`,
        } as CSSProperties
      }
    >
      {onEditContent && (
        <Button variant="secondary" dense size="sm" className="w-full" onClick={onEditContent}>
          <Pencil size={16} strokeWidth={2.5} aria-hidden />
          {es.content.editor.edit}
        </Button>
      )}
      {untracked && !onEditContent && (
        <div className="border-hair space-y-1 rounded-md bg-sun-tint p-2">
          <Badge tone="sun">
            <TriangleAlert size={13} strokeWidth={2.5} aria-hidden />
            {es.completion.untracked}
          </Badge>
          {onConfigureCompletion && (
            <Button variant="secondary" dense size="sm" onClick={onConfigureCompletion}>
              {es.completion.configure}
            </Button>
          )}
        </div>
      )}
      {availability === 'hidden' && (
        <div className="border-hair space-y-1 rounded-md bg-sun-tint p-2">
          <Badge tone="sun">{es.sidebar.hiddenBadge}</Badge>
          <p className="text-xs font-semibold text-sun-dark">{es.bubble.hiddenHintEditor}</p>
        </div>
      )}
      {availability === 'missing' && (
        <div className="space-y-1 border-hair rounded-md bg-danger-tint p-2">
          <p className="text-xs font-bold text-danger">{es.bubble.missingHintEditor}</p>
        </div>
      )}
      {embed && resolvedActivity && (
        <button
          type="button"
          onClick={() => embed.openActivity(resolvedActivity.activityId)}
          className="flex min-h-[44px] items-center gap-1.5 text-xs font-bold text-primary underline-offset-2 hover:underline"
        >
          <ExternalLink size={14} strokeWidth={2.5} aria-hidden />
          {es.bubble.openInMoodle}
        </button>
      )}
      {resolvedActivity && isSafeActivityUrl(resolvedActivity.url) && (
        <a
          href={resolvedActivity.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[44px] items-center gap-1.5 text-xs font-bold text-primary underline-offset-2 hover:underline"
        >
          <ExternalLink size={14} strokeWidth={2.5} aria-hidden />
          {es.bubble.openInMoodle}
        </a>
      )}
      <div className="grid grid-cols-4 gap-1.5">
        {ICON_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            role="menuitemradio"
            aria-checked={currentIcon ? currentIcon === key : key === 'question'}
            title={ICON_LABELS[key]}
            onClick={() => onSelect(key)}
            className={`flex h-11 w-11 items-center justify-center rounded-md transition-colors ${
              (currentIcon ?? 'question') === key
                ? 'border-strong bg-accent'
                : 'border-hair bg-surface hover:bg-primary-tint'
            }`}
          >
            {ICON_DATA_URIS_LIGHT[key] ? (
              <span className="flex h-6 w-6 items-center justify-center rounded-pill bg-slate-dark">
                <img src={ICON_DATA_URIS_LIGHT[key]} alt="" className="h-4 w-4" />
              </span>
            ) : (
              <span className="flex h-6 w-6 items-center justify-center rounded-pill bg-slate-dark text-xs font-bold text-white">
                ?
              </span>
            )}
          </button>
        ))}
      </div>

      {skins && skins.length > 0 && onSkinSelect && (
        <label className="block space-y-1">
          <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">
            {es.studio.bubbles.applyToSelected}
          </span>
          <select
            value={currentSkinId ?? ''}
            onChange={(e) => onSkinSelect(e.target.value || null)}
            className="border-soft min-h-[44px] w-full rounded-md bg-surface px-2 text-sm font-semibold text-ink"
          >
            <option value="">{es.studio.bubbles.clearOverride}</option>
            {skins.map((skin) => (
              <option key={skin.id} value={skin.id}>
                {skin.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Demo only. Embedded, progress comes from Moodle completion instead. */}
      {!embed && !onEditContent && (
        <label className="block space-y-1">
          <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">
            {es.bubble.demoStatusLabel}
          </span>
          <select
            value={currentStatus}
            onChange={(e) => onStatusSelect(e.target.value as BubbleStatus)}
            className="border-soft min-h-[44px] w-full rounded-md bg-surface px-2 text-sm font-semibold text-ink"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <Button
        dense
        variant={isConfirmingDelete ? 'danger' : 'dangerGhost'}
        onClick={() => (isConfirmingDelete ? onDelete() : setIsConfirmingDelete(true))}
        className="w-full"
      >
        <Trash2 size={16} strokeWidth={2.5} aria-hidden />
        {isConfirmingDelete ? es.bubble.confirmDelete : es.bubble.removeFromMap}
      </Button>
    </div>
  )
}
