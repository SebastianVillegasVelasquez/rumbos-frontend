import type { CameraAction, Insets } from './protocol.ts'

// The seam between the HUD (which draws the camera buttons and knows what it
// covers) and the 3D bridge (which talks to the iframe). Module-level on
// purpose: the two live in different parts of the tree and only meet here.

export interface CameraState {
  canZoomIn: boolean
  canZoomOut: boolean
}

export const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 }
const INITIAL_STATE: CameraState = { canZoomIn: true, canZoomOut: true }

let send: ((action: CameraAction) => void) | null = null
let state: CameraState = INITIAL_STATE
let insets: Insets = NO_INSETS
const stateListeners = new Set<() => void>()
const insetListeners = new Set<() => void>()

const sameInsets = (a: Insets, b: Insets) =>
  a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left

export const cameraBridge = {
  // The bridge registers how to reach the iframe while it is mounted.
  attach: (sender: (action: CameraAction) => void) => {
    send = sender
    return () => {
      if (send === sender) send = null
      state = INITIAL_STATE
      stateListeners.forEach((listener) => listener())
    }
  },
  command: (action: CameraAction) => send?.(action),

  getState: () => state,
  setState: (next: CameraState) => {
    if (next.canZoomIn === state.canZoomIn && next.canZoomOut === state.canZoomOut) return
    state = next
    stateListeners.forEach((listener) => listener())
  },
  subscribeState: (listener: () => void) => {
    stateListeners.add(listener)
    return () => void stateListeners.delete(listener)
  },

  getInsets: () => insets,
  setInsets: (next: Insets) => {
    if (sameInsets(next, insets)) return
    insets = next
    insetListeners.forEach((listener) => listener())
  },
  subscribeInsets: (listener: () => void) => {
    insetListeners.add(listener)
    return () => void insetListeners.delete(listener)
  },
}
