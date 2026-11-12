// How big the welcome video panel is. The size comes from the measured box of
// its container (width first, capped by the room left in height), keeps 16:9
// and never goes under a hard minimum. When the room is too short the curtain
// scrolls; the panel does not shrink. The same rules live in
// styles/video-panel.css as the pure-CSS fallback that works before any
// script runs (or where ResizeObserver is missing).

export const PANEL_RATIO = 16 / 9
// The smallest panel that is still usable (about 280x158).
export const PANEL_MIN_WIDTH = 280
export const PANEL_MIN_HEIGHT = 158
// Height the curtain keeps for what is around the panel in video mode: the
// column's padding (32), the gap and the row with "Saltar" and "Empezar viaje" (64) and the
// footer with the fullscreen button (56), rounded up. Keep in sync with
// --video-reserve in styles/video-panel.css.
export const PANEL_RESERVE_PX = 160

export interface PanelSize {
  width: number
  height: number
}

interface FitInput {
  // Content width and height the container offers, in CSS px.
  availWidth: number
  availHeight: number
  reserve?: number
  ratio?: number
  minWidth?: number
  minHeight?: number
}

const usable = (value: number) => Number.isFinite(value) && value > 0

// The size for the panel, or null while the container has no real box yet (a
// first measurement of zero must not collapse anything: the CSS fallback keeps
// the panel until a real one arrives).
export const fitVideoPanel = ({
  availWidth,
  availHeight,
  reserve = PANEL_RESERVE_PX,
  ratio = PANEL_RATIO,
  minWidth = PANEL_MIN_WIDTH,
  minHeight = PANEL_MIN_HEIGHT,
}: FitInput): PanelSize | null => {
  if (!usable(availWidth) || !usable(availHeight) || !usable(ratio)) return null
  // Width-driven, capped by the height that is left.
  const byHeight = Math.max(0, availHeight - reserve) * ratio
  const wanted = Math.min(availWidth, byHeight)
  // The minimum wins over the height cap, but a container narrower than the
  // minimum cannot be overflowed by it.
  const floor = Math.min(Math.max(minWidth, Math.ceil(minHeight * ratio)), availWidth)
  const width = Math.floor(Math.max(wanted, floor))
  return { width, height: Math.round(width / ratio) }
}
