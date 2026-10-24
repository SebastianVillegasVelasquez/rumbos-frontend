import type { Insets } from '../view3d/protocol.ts'

export type HudEdge = 'top' | 'right' | 'bottom' | 'left'

interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

// What the HUD covers, per edge of the stage, in CSS px: each control is
// assigned to the edge it hangs from, and an edge's inset is how far the
// farthest of its controls reaches into the stage. Rounded up so a fractional
// pixel never lets content slip under a button.
export const computeInsets = (
  stage: Box,
  items: readonly { edge: HudEdge; box: Box }[]
): Insets => {
  const insets: Insets = { top: 0, right: 0, bottom: 0, left: 0 }
  for (const { edge, box } of items) {
    if (box.right <= box.left || box.bottom <= box.top) continue
    const reach =
      edge === 'top'
        ? box.bottom - stage.top
        : edge === 'bottom'
          ? stage.bottom - box.top
          : edge === 'left'
            ? box.right - stage.left
            : stage.right - box.left
    insets[edge] = Math.max(insets[edge], Math.max(0, Math.ceil(reach)))
  }
  return insets
}
