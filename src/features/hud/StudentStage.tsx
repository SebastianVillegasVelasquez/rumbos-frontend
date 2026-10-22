import { useEffect, useRef, type ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Box,
  CheckCircle2,
  Layers,
  ListChecks,
  Map as MapIcon,
  Maximize2,
  Minus,
  Plus,
  Scan,
} from 'lucide-react'
import { Button, IconButton } from '../../components/ui/Button.tsx'
import { es } from '../../i18n/es.ts'
import type { ProgressCounts } from '../course-map/progress.ts'
import type { MapViewKind } from '../view3d/mapViewPreference.ts'
import { hudMetrics, type HudMetrics } from './metrics.ts'
import { useIdleDim } from './useIdleDim.ts'
import { useStageSize } from './useStageSize.ts'
import { isCoarsePointer } from './pointer.ts'

export type ContinueAction =
  | { kind: 'continue'; label: string; onClick: () => void }
  | { kind: 'next-level'; onClick: () => void }
  | { kind: 'done' }
  | { kind: 'none' }

interface StudentStageProps {
  levelTitle: string
  levelPosition: { index: number; count: number } | null
  progress: ProgressCounts
  // Absent when the course has a single level.
  onOpenLevels?: () => void
  onOpenQuests: () => void
  // The 2D/3D switch; absent when the published map has no 3D view.
  view: { value: MapViewKind; onChange: (view: MapViewKind) => void } | null
  // Camera buttons; absent in 3D, which has its own.
  zoom: { zoomIn: () => void; zoomOut: () => void; recenter: () => void } | null
  // Absent while the host owns fullscreen (its exit control is in the corner).
  onEnterFullscreen: (() => void) | null
  continueAction: ContinueAction
  // An editor looking at the student view: the way back to editing.
  exitPreview: { label: string; onExit: () => void } | null
  // Keeps the controls fully visible (a panel is open).
  hold: boolean
  embedded: boolean
  children: (layout: Pick<HudMetrics, 'guardCompact'>) => ReactNode
}

// The student's stage: the map fills the screen and every control floats at an
// edge. The top-right corner stays empty on purpose; the host puts its exit
// control there in fullscreen. Placement rules live in metrics.ts, where a test
// checks them across screen sizes.
export const StudentStage = ({
  levelTitle,
  levelPosition,
  progress,
  onOpenLevels,
  onOpenQuests,
  view,
  zoom,
  onEnterFullscreen,
  continueAction,
  exitPreview,
  hold,
  embedded,
  children,
}: StudentStageProps) => {
  const stageRef = useRef<HTMLDivElement>(null)
  const { width, height } = useStageSize(stageRef)
  const dimmed = useIdleDim(hold)

  // The toast stack would sit on top of "Continuar".
  useEffect(() => {
    document.documentElement.style.setProperty('--hud-toast-lift', '4rem')
    return () => {
      document.documentElement.style.removeProperty('--hud-toast-lift')
    }
  }, [])

  const clusterButtons = (zoom ? 3 : 0) + (view ? 1 : 0) + (onEnterFullscreen ? 1 : 0)
  const metrics = hudMetrics({
    width,
    height,
    guardsTouch: embedded && isCoarsePointer(),
    clusterButtons,
    hasLevelsButton: Boolean(onOpenLevels),
    hasPreviewPill: Boolean(exitPreview),
  })

  const inset = (side: 'top' | 'right' | 'bottom' | 'left') =>
    `max(0.5rem, env(safe-area-inset-${side}, 0px))`

  // The title gives way (with an ellipsis) so the progress is never cut off.
  const chipProgress = progress.nothingTracked
    ? es.hud.chipNoTracking
    : progress.total > 0
      ? es.hud.chipProgress(progress.completed, progress.total)
      : null
  const chip = (
    <div
      className="hud-chip pointer-events-none absolute z-10 rounded-md px-3 py-1.5 text-white"
      style={{
        background: 'var(--hud-scrim)',
        maxWidth: metrics.chipMaxWidth,
        ...(metrics.chipOnTop
          ? { top: inset('top'), left: '50%', transform: 'translateX(-50%)' }
          : {
              left: inset('left'),
              bottom: `calc(${inset('bottom')} + ${metrics.rects.guard ? '52px' : '0px'})`,
            }),
      }}
    >
      {levelPosition && (
        <span className="block text-xs font-semibold">
          {es.hud.levelPosition(levelPosition.index, levelPosition.count)}
        </span>
      )}
      <span className="flex gap-1 text-sm font-bold" title={levelTitle}>
        <span className="min-w-0 truncate">{levelTitle}</span>
        {chipProgress && <span className="shrink-0">{chipProgress}</span>}
      </span>
    </div>
  )

  const labelClass = metrics.topLeftLabels ? undefined : 'sr-only'

  return (
    <div ref={stageRef} className="relative h-full w-full" data-hud-dim={dimmed}>
      {children({ guardCompact: metrics.guardCompact })}

      <div
        role="group"
        aria-label={es.hud.controls}
        className="pointer-events-none absolute z-10 flex gap-2"
        style={{
          top: inset('top'),
          left: inset('left'),
          flexDirection: metrics.topLeftColumn ? 'column' : 'row',
        }}
      >
        {onOpenLevels && (
          <Button
            variant="surface"
            size="sm"
            dense
            className="hud-dimmable pointer-events-auto min-w-[44px]"
            onClick={onOpenLevels}
            title={es.hud.levels}
          >
            <Layers size={18} strokeWidth={2.5} aria-hidden />
            <span className={labelClass}>{es.hud.levels}</span>
          </Button>
        )}
        <Button
          variant="surface"
          size="sm"
          dense
          className="hud-dimmable pointer-events-auto min-w-[44px]"
          onClick={onOpenQuests}
          title={es.hud.quests}
        >
          <ListChecks size={18} strokeWidth={2.5} aria-hidden />
          <span className={labelClass}>{es.hud.quests}</span>
        </Button>
      </div>

      {chip}

      {exitPreview && (
        <Button
          variant="secondary"
          size="sm"
          dense
          className="hud-dimmable pointer-events-auto absolute z-10"
          style={{
            left: inset('left'),
            top: '50%',
            transform: 'translateY(-50%)',
            maxWidth: metrics.pillMaxWidth,
          }}
          onClick={exitPreview.onExit}
        >
          <ArrowLeft size={16} strokeWidth={2.5} aria-hidden className="shrink-0" />
          <span className="min-w-0 truncate">{exitPreview.label}</span>
        </Button>
      )}

      <div
        role="group"
        aria-label={es.hud.controls}
        className="pointer-events-none absolute z-10 flex flex-col flex-wrap-reverse content-start justify-end gap-2"
        style={{
          right: inset('right'),
          bottom: inset('bottom'),
          maxHeight: metrics.clusterMaxHeight,
        }}
      >
        {zoom && (
          <>
            <IconButton
              variant="surface"
              className="hud-dimmable pointer-events-auto"
              aria-label={es.canvas.zoomIn}
              title={es.canvas.zoomIn}
              onClick={zoom.zoomIn}
            >
              <Plus size={18} strokeWidth={3} aria-hidden />
            </IconButton>
            <IconButton
              variant="surface"
              className="hud-dimmable pointer-events-auto"
              aria-label={es.canvas.zoomOut}
              title={es.canvas.zoomOut}
              onClick={zoom.zoomOut}
            >
              <Minus size={18} strokeWidth={3} aria-hidden />
            </IconButton>
            <IconButton
              variant="surface"
              className="hud-dimmable pointer-events-auto"
              aria-label={es.hud.recenter}
              title={es.hud.recenter}
              onClick={zoom.recenter}
            >
              <Scan size={18} strokeWidth={2.5} aria-hidden />
            </IconButton>
          </>
        )}
        {view && (
          <IconButton
            variant="surface"
            className="hud-dimmable pointer-events-auto"
            aria-label={view.value === '2d' ? es.view3d.switchTo3d : es.view3d.switchTo2d}
            title={view.value === '2d' ? es.view3d.switchTo3d : es.view3d.switchTo2d}
            onClick={() => view.onChange(view.value === '2d' ? '3d' : '2d')}
          >
            {view.value === '2d' ? (
              <Box size={18} strokeWidth={2.5} aria-hidden />
            ) : (
              <MapIcon size={18} strokeWidth={2.5} aria-hidden />
            )}
          </IconButton>
        )}
        {onEnterFullscreen && (
          <IconButton
            variant="surface"
            className="hud-dimmable pointer-events-auto"
            aria-label={es.embed.fullscreen}
            title={es.embed.fullscreen}
            onClick={onEnterFullscreen}
          >
            <Maximize2 size={18} strokeWidth={2.5} aria-hidden />
          </IconButton>
        )}
      </div>

      {continueAction.kind !== 'none' && (
        <div
          className="pointer-events-none absolute z-10 flex justify-center"
          style={{
            left: '50%',
            transform: 'translateX(-50%)',
            bottom: inset('bottom'),
            width: metrics.continueMaxWidth,
          }}
        >
          {continueAction.kind === 'done' ? (
            <p
              className="hud-chip border-soft inline-flex min-h-[44px] max-w-full items-center gap-2 rounded-md bg-leaf-tint px-4 text-sm font-bold text-leaf-dark"
              role="status"
            >
              <CheckCircle2 size={18} strokeWidth={2.5} aria-hidden className="shrink-0" />
              <span className="min-w-0 truncate">{es.hud.levelDone}</span>
            </p>
          ) : (
            <Button
              size="sm"
              className="hud-dimmable pointer-events-auto max-w-full"
              onClick={continueAction.onClick}
              aria-label={
                continueAction.kind === 'continue' ? continueAction.label : es.levels.goToNextLevel
              }
            >
              <span className="min-w-0 truncate">
                {continueAction.kind === 'continue'
                  ? metrics.continueIconOnly
                    ? es.hud.continueShort
                    : continueAction.label
                  : es.levels.goToNextLevel}
              </span>
              <ArrowRight size={16} strokeWidth={3} aria-hidden className="shrink-0" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
