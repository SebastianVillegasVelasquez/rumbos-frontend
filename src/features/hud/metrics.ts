// The geometry of the student HUD, as numbers.
//
// The HUD is a set of small controls pinned to the edges of the map. Whether
// they collide depends only on the viewport, a few flags and fixed sizes, so
// the layout rules live here as a pure function: the stage renders from it and
// a test walks a grid of screen sizes to prove nothing overlaps and nothing
// enters the corner the host reserves.

export const TOUCH_TARGET = 44
export const GAP = 8
export const GUTTER = 8
// The host's exit control in fullscreen (contract v5.4). The HUD leaves this
// square empty at all times, fullscreen or not.
export const CORNER = 64

// Breakpoints. Below NARROW the level chip moves to the top; below COMPACT the
// icon-only variants are used.
export const NARROW = 480
export const COMPACT = 640

const CHIP_HEIGHT = 52
const GUARD_TEXT_WIDTH = 140
const LABELED_BUTTON_WIDTH = 116
const MIN_CONTINUE_WIDTH = 96
const MAX_CONTINUE_WIDTH = 320

export interface HudInput {
  width: number
  height: number
  // A touch screen embedded in the host page: the "Mover el mapa" button exists.
  guardsTouch: boolean
  // Buttons in the bottom-right cluster (zoom x2, recenter, view, audio, fullscreen).
  clusterButtons: number
  // "Niveles" is present only when the course has several levels.
  hasLevelsButton: boolean
  hasPreviewPill: boolean
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface HudMetrics {
  // Below COMPACT: icon-only buttons and a bottom sheet instead of a side panel.
  compact: boolean
  chipOnTop: boolean
  guardCompact: boolean
  topLeftColumn: boolean
  topLeftLabels: boolean
  chipMaxWidth: number
  pillMaxWidth: number
  clusterColumns: number
  // Tallest the cluster may grow before it wraps into another column.
  clusterMaxHeight: number
  continueMaxWidth: number
  // Too little room for the label: show the icon only.
  continueIconOnly: boolean
  rects: {
    corner: Rect
    topLeft: Rect
    chip: Rect
    pill: Rect | null
    cluster: Rect
    guard: Rect | null
    continue: Rect
  }
}

const stack = (count: number) => (count <= 0 ? 0 : count * TOUCH_TARGET + (count - 1) * GAP)

export const hudMetrics = (input: HudInput): HudMetrics => {
  const { width, height, guardsTouch, clusterButtons, hasLevelsButton, hasPreviewPill } = input

  const chipOnTop = width < NARROW
  const guardCompact = guardsTouch && width < COMPACT
  const topLeftColumn = width < NARROW
  const topLeftLabels = width >= COMPACT
  const guardWidth = guardsTouch ? (guardCompact ? TOUCH_TARGET : GUARD_TEXT_WIDTH) : 0

  // Below NARROW the chip is centered at the top between the buttons on the
  // left and the corner on the right, so it is held a little under the 60vw
  // ceiling to keep clear of both on the narrowest phones.
  const chipMaxWidth = chipOnTop ? Math.min(width * 0.56, 280) : Math.min(width * 0.34, 256)
  const pillMaxWidth = Math.min(width * 0.6, 240)

  // The cluster is a column anchored at the bottom right; when the screen is
  // too short it wraps into a second column to the left instead of growing up
  // into the reserved corner.
  const clusterMaxHeight = Math.max(TOUCH_TARGET, height - CORNER - GAP - GUTTER)
  const perColumn = Math.max(1, Math.floor((clusterMaxHeight + GAP) / (TOUCH_TARGET + GAP)))
  const clusterColumns = Math.max(1, Math.ceil(clusterButtons / perColumn))
  const clusterWidth = clusterColumns * TOUCH_TARGET + (clusterColumns - 1) * GAP
  const clusterRows = Math.min(clusterButtons, perColumn)
  const clusterHeight = stack(clusterRows)

  const leftReserve = guardsTouch ? GUTTER + guardWidth : chipOnTop ? GUTTER : GUTTER + chipMaxWidth
  const rightReserve = GUTTER + clusterWidth
  const side = Math.max(leftReserve, rightReserve) + GAP
  const rawContinue = Math.min(MAX_CONTINUE_WIDTH, width - 2 * side)
  const continueIconOnly = rawContinue < MIN_CONTINUE_WIDTH
  const continueMaxWidth = Math.max(TOUCH_TARGET, rawContinue)

  // Niveles (optional), Misiones and Ajustes. Ajustes is always icon-only.
  const topLeftButtons = (hasLevelsButton ? 1 : 0) + 2
  const topLeft: Rect = topLeftColumn
    ? { x: GUTTER, y: GUTTER, w: TOUCH_TARGET, h: stack(topLeftButtons) }
    : topLeftLabels
      ? {
          x: GUTTER,
          y: GUTTER,
          w:
            (topLeftButtons - 1) * LABELED_BUTTON_WIDTH + TOUCH_TARGET + (topLeftButtons - 1) * GAP,
          h: TOUCH_TARGET,
        }
      : { x: GUTTER, y: GUTTER, w: stack(topLeftButtons), h: TOUCH_TARGET }

  const guard: Rect | null = guardsTouch
    ? { x: GUTTER, y: height - GUTTER - TOUCH_TARGET, w: guardWidth, h: TOUCH_TARGET }
    : null

  const chip: Rect = chipOnTop
    ? { x: (width - chipMaxWidth) / 2, y: GUTTER, w: chipMaxWidth, h: CHIP_HEIGHT }
    : {
        x: GUTTER,
        y: height - GUTTER - (guardsTouch ? TOUCH_TARGET + GAP : 0) - CHIP_HEIGHT,
        w: chipMaxWidth,
        h: CHIP_HEIGHT,
      }

  return {
    compact: width < COMPACT,
    chipOnTop,
    guardCompact,
    topLeftColumn,
    topLeftLabels,
    chipMaxWidth,
    pillMaxWidth,
    clusterColumns,
    clusterMaxHeight,
    continueMaxWidth,
    continueIconOnly,
    rects: {
      corner: { x: width - CORNER, y: 0, w: CORNER, h: CORNER },
      topLeft,
      chip,
      pill: hasPreviewPill
        ? {
            x: GUTTER,
            // Centered, but never up into the stack of buttons at the top left.
            y: Math.max(height / 2 - TOUCH_TARGET / 2, topLeft.y + topLeft.h + GAP),
            w: pillMaxWidth,
            h: TOUCH_TARGET,
          }
        : null,
      cluster: {
        x: width - GUTTER - clusterWidth,
        y: height - GUTTER - clusterHeight,
        w: clusterWidth,
        h: clusterHeight,
      },
      guard,
      continue: {
        x: (width - continueMaxWidth) / 2,
        y: height - GUTTER - TOUCH_TARGET,
        w: continueMaxWidth,
        h: TOUCH_TARGET,
      },
    },
  }
}

export const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
