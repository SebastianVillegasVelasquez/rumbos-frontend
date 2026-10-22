import { useMemo, useState } from 'react'
import { ChevronDown, ListChecks, Loader2 } from 'lucide-react'
import { Popover } from '../../components/ui/Popover.tsx'
import { useToast } from '../../components/ui/toastContext.ts'
import { es } from '../../i18n/es.ts'
import type { RenderableMap } from '../course-map/renderable.ts'
import type { RenderableBubble, ResolvedCourseMap, View3d } from '../course-map/data/types.ts'
import type { MapView } from '../course-map/visualState.ts'
import { buildPoints3d } from './buildPoints3d.ts'
import { Map3DActivityList } from './Map3DActivityList.tsx'
import Map3DView from './Map3DView.tsx'
import { isPinOpenable } from './pinState.ts'
import type { Locale3d } from './protocol.ts'

interface Map3DPanelProps {
  map: RenderableMap
  view3d: View3d
  resolved: ResolvedCourseMap | undefined
  // True until the resolved Moodle data settled (success or failure), so the
  // world is not drawn twice with different titles.
  isLoading: boolean
  view: MapView
  locale?: Locale3d
  // The same opener and availability reasons the 2D canvas uses.
  onOpenBubble: (bubble: RenderableBubble) => void
  getUnavailableReason: (bubble: RenderableBubble) => string | null
  // Asked from outside (HUD "continuar", the overview list).
  focusBubbleId: string | null
  onFocusHandled: () => void
  onBackTo2d: () => void
  // False when the student HUD offers the activity list itself (Misiones).
  showActivityList?: boolean
}

// The 3D view of a level: the world plus the accessible list next to it. It
// only translates between 3D points and the app's own bubbles; all game rules
// (state, availability, opening) stay in the shared 2D code paths.
export const Map3DPanel = ({
  map,
  view3d,
  resolved,
  isLoading,
  view,
  locale = 'es',
  onOpenBubble,
  getUnavailableReason,
  focusBubbleId,
  onFocusHandled,
  onBackTo2d,
  showActivityList = true,
}: Map3DPanelProps) => {
  const toast = useToast()
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [listFocusId, setListFocusId] = useState<string | null>(null)
  const [listOpen, setListOpen] = useState(false)

  const points = useMemo(
    () => buildPoints3d(map, view3d, resolved, locale, view),
    [map, view3d, resolved, locale, view]
  )
  const bubbleById = useMemo(
    () => new Map(map.bubbles.map((bubble) => [bubble.id, bubble])),
    [map.bubbles]
  )

  if (isLoading) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
        <Loader2 size={16} className="motion-safe:animate-spin" aria-hidden />
        {es.view3d.loading}
      </p>
    )
  }

  const pointOf = (pointId: string) => points.find((point) => point.id === pointId)

  // Clicking a pin that cannot be opened explains why, like the 2D tooltip.
  const handlePinClick = (pointId: string) => {
    setHighlightedId(pointId)
    const point = pointOf(pointId)
    const bubble = bubbleById.get(pointId)
    if (!point || !bubble || isPinOpenable(point.state)) return
    const reason =
      getUnavailableReason(bubble) ?? (point.state === 'locked' ? es.view3d.lockedHint : null)
    if (reason) toast.show(reason, 'info')
  }

  const handleOpen = (pointId: string) => {
    setHighlightedId(pointId)
    const bubble = bubbleById.get(pointId)
    if (!bubble) return
    const reason = getUnavailableReason(bubble)
    if (reason) toast.show(reason, 'info')
    else onOpenBubble(bubble)
  }

  const requestedFocus = points.some((point) => point.id === focusBubbleId) ? focusBubbleId : null

  return (
    <div className="relative h-full min-h-[360px]">
      <Map3DView
        scene={view3d.scene}
        locale={locale}
        points={points}
        title={es.view3d.iframeTitle(map.title)}
        onPinClick={handlePinClick}
        onOpenActivity={handleOpen}
        focusPointId={listFocusId ?? requestedFocus}
        onFocusHandled={() => {
          setListFocusId(null)
          onFocusHandled()
        }}
        onBackTo2d={onBackTo2d}
      />
      {showActivityList && (
        <>
          {/* The accessible twin of the canvas, folded away so the world gets the space. */}
          <div className="absolute bottom-2 left-2 z-10">
            <Popover
              open={listOpen}
              onOpenChange={setListOpen}
              align="start"
              trigger={
                <button
                  type="button"
                  className="border-strong inline-flex min-h-[44px] items-center gap-2 rounded-md bg-surface px-3 text-sm font-bold text-ink shadow-md hover:bg-primary-tint"
                >
                  <ListChecks size={16} strokeWidth={2.5} aria-hidden />
                  {es.app.activities}
                  <ChevronDown
                    size={16}
                    strokeWidth={3}
                    aria-hidden
                    className={`motion-safe:transition-transform ${listOpen ? '' : 'rotate-180'}`}
                  />
                </button>
              }
            >
              <div className="max-h-[60dvh] w-[min(22rem,calc(100vw-4rem))] overflow-y-auto">
                <Map3DActivityList
                  scene={view3d.scene}
                  points={points}
                  highlightedId={highlightedId}
                  onFocus={(pointId) => {
                    setHighlightedId(pointId)
                    setListFocusId(pointId)
                  }}
                  onOpen={handleOpen}
                />
              </div>
            </Popover>
          </div>
        </>
      )}
    </div>
  )
}
