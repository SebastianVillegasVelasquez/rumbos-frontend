import { Eye, ExternalLink } from 'lucide-react'
import { Badge } from '../../components/ui/Card.tsx'
import { es } from '../../i18n/es.ts'
import { getScene3d } from '../../scenes3d/registry.ts'
import { isPinOpenable } from './pinState.ts'
import type { PinState, Point3D } from './protocol.ts'

const TONE: Record<PinState, 'leaf' | 'teal' | 'sun' | 'slate' | 'coral'> = {
  locked: 'slate',
  available: 'sun',
  next: 'sun',
  complete: 'leaf',
  teaser: 'slate',
  missing: 'coral',
}

interface Map3DActivityListProps {
  scene: string
  points: Point3D[]
  // The point the last pin click (or focus) pointed at.
  highlightedId: string | null
  onFocus: (pointId: string) => void
  onOpen: (pointId: string) => void
}

// The keyboard- and screen-reader-friendly twin of the canvas: every point
// with its state, a button to fly the camera there and one to open it.
export const Map3DActivityList = ({
  scene,
  points,
  highlightedId,
  onFocus,
  onOpen,
}: Map3DActivityListProps) => {
  const zones = getScene3d(scene)?.zones ?? []
  const nameOf = (point: Point3D) =>
    point.title ?? zones.find((zone) => zone.id === point.zoneId)?.title.es ?? point.id

  return (
    <section aria-labelledby="view3d-list-title" className="flex min-h-0 flex-col gap-2">
      <div>
        <h2 id="view3d-list-title" className="font-heading text-base font-extrabold text-ink">
          {es.view3d.listTitle}
        </h2>
        <p className="text-xs font-semibold text-ink-soft">{es.view3d.listHint}</p>
      </div>
      {points.length === 0 ? (
        <p className="text-sm font-semibold text-ink-soft">{es.view3d.listEmpty}</p>
      ) : (
        <ul className="min-h-0 space-y-1.5 overflow-y-auto">
          {points.map((point) => {
            const name = nameOf(point)
            const highlighted = point.id === highlightedId
            return (
              <li
                key={point.id}
                aria-current={highlighted ? 'true' : undefined}
                className={`flex flex-wrap items-center gap-2 rounded-md px-3 py-2 text-sm ${
                  highlighted ? 'border-soft bg-primary-tint' : 'border-hair bg-surface-muted'
                }`}
              >
                <span className="min-w-0 flex-1 truncate font-semibold text-ink" title={name}>
                  {name}
                </span>
                <Badge tone={TONE[point.state]}>{es.view3d.stateLabels[point.state]}</Badge>
                <button
                  type="button"
                  onClick={() => onFocus(point.id)}
                  disabled={point.state === 'missing'}
                  aria-label={es.view3d.focusAria(name)}
                  title={es.view3d.focus}
                  className="border-soft inline-flex h-11 w-11 items-center justify-center rounded-md bg-surface text-ink hover:bg-primary-tint disabled:opacity-50"
                >
                  <Eye size={18} strokeWidth={2.5} aria-hidden />
                </button>
                {isPinOpenable(point.state) && (
                  <button
                    type="button"
                    onClick={() => onOpen(point.id)}
                    aria-label={es.view3d.openAria(name)}
                    title={es.view3d.open}
                    className="border-soft inline-flex h-11 w-11 items-center justify-center rounded-md bg-surface text-ink hover:bg-accent"
                  >
                    <ExternalLink size={18} strokeWidth={2.5} aria-hidden />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
