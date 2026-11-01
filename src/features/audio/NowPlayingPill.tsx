import { useLayoutEffect, useRef, useState } from 'react'
import { pillLevelForRoom, pillLines, type TrackText } from './nowPlaying.ts'

const GAP = 8
// Below this there is no room for even a short title: the pill stays hidden and
// the popover holds the text.
const MIN_ROOM = 72

interface Placement {
  // Distance from the disc's right edge to the cluster's left edge, plus a gap.
  offset: number
  room: number
  // How far the pill is raised above the disc's bottom edge (0 or one row).
  lift: number
}

// One HUD row: a control plus the gap. Raising the pill by this much takes it
// clear of whatever shares the disc's own row (Continuar, the level chip).
const ROW = 52

// The pill sits left of the whole bottom-right cluster (which can wrap into
// several columns on a short screen), aligned to the disc's bottom edge (it grows upward, never off the screen), and is
// never wider than the room up to the nearest other HUD control in its way.
const measureAt = (anchor: HTMLElement, lift: number): Placement | null => {
  const disc = anchor.getBoundingClientRect()
  const cluster = anchor.closest('[data-hud-edge="right"]')
  if (!cluster) return null
  const clusterLeft = cluster.getBoundingClientRect().left
  const top = disc.bottom - lift - 64
  const bottom = disc.bottom - lift
  let bound = 0
  const stage = cluster.parentElement
  for (const other of stage?.querySelectorAll('[data-hud-edge]') ?? []) {
    if (other === cluster || other.contains(anchor)) continue
    const rect = other.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) continue
    // Only what shares the pill's rows and lies to its left.
    if (rect.bottom <= top || rect.top >= bottom || rect.left >= clusterLeft) continue
    bound = Math.max(bound, rect.right)
  }
  const stageLeft = stage?.getBoundingClientRect().left ?? 0
  const room = clusterLeft - GAP - Math.max(bound + GAP, stageLeft + GAP)
  // An absolute child is positioned from the button's padding box, inside its border.
  const style = getComputedStyle(anchor)
  const borderRight = parseFloat(style.borderRightWidth) || 0
  const borderBottom = parseFloat(style.borderBottomWidth) || 0
  return { offset: disc.right - borderRight - clusterLeft + GAP, room, lift: lift - borderBottom }
}

// Beside the disc when there is room for at least two lines; otherwise one row
// higher, where the bottom row's controls are no longer in the way.
const MIN_ROOM_TWO = 140
const measure = (anchor: HTMLElement): Placement | null => {
  const level = measureAt(anchor, 0)
  if (!level || level.room >= MIN_ROOM_TWO) return level
  const raised = measureAt(anchor, ROW)
  return raised && raised.room > level.room ? raised : level
}

export const NowPlayingPill = ({
  track,
  anchor,
}: {
  track: TrackText
  anchor: HTMLElement | null
}) => {
  const [placement, setPlacement] = useState<Placement | null>(null)
  const ref = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    if (!anchor) return
    const update = () => setPlacement(measure(anchor))
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [anchor])

  if (!placement || placement.room < MIN_ROOM) return null
  const level = pillLevelForRoom(placement.room)
  const lines = pillLines(track, level)

  return (
    <span
      ref={ref}
      aria-hidden
      data-layout-watch="now-playing-pill"
      className="pill-in hud-chip pointer-events-none absolute z-10 rounded-md px-3 py-1.5 text-left text-white"
      style={{
        right: placement.offset,
        bottom: placement.lift,
        width: 'max-content',
        maxWidth: placement.room,
        background: 'var(--hud-scrim)',
      }}
    >
      {lines.map((line) => (
        <span
          key={line.key}
          className={`block truncate ${
            line.key === 'title'
              ? 'text-sm font-extrabold'
              : line.key === 'license'
                ? 'text-xs font-semibold'
                : 'text-xs font-bold'
          }`}
        >
          {line.text}
        </span>
      ))}
    </span>
  )
}
