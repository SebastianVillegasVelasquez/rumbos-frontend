// The pure part of the development-only layout check (?debug=layout): which
// pairs of boxes collide. Kept free of the DOM so it can be tested.

export interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

export interface Item {
  // A readable name for the report.
  label: string
  box: Box
  // Items in different layers (a modal dialog, a popover) are not compared:
  // an overlay is meant to cover what is under it.
  layer: string
  // Ancestry as a path of node indexes, so containment can be told apart from a collision.
  path: readonly number[]
}

export interface Collision {
  a: string
  b: string
  // Size of the shared area in CSS px.
  width: number
  height: number
}

// Less than this is a shared border, not an overlap.
const MIN_OVERLAP = 2

const isPrefix = (shorter: readonly number[], longer: readonly number[]) =>
  shorter.length < longer.length && shorter.every((value, i) => longer[i] === value)

export const findCollisions = (items: readonly Item[]): Collision[] => {
  const found: Collision[] = []
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i]
      const b = items[j]
      if (a.layer !== b.layer) continue
      // A button inside its own panel is containment, not a collision.
      if (isPrefix(a.path, b.path) || isPrefix(b.path, a.path)) continue
      const width = Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left)
      const height = Math.min(a.box.bottom, b.box.bottom) - Math.max(a.box.top, b.box.top)
      if (width >= MIN_OVERLAP && height >= MIN_OVERLAP) {
        found.push({ a: a.label, b: b.label, width: Math.round(width), height: Math.round(height) })
      }
    }
  }
  return found
}
