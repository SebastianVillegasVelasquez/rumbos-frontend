import type { Ref } from 'react'
import type { DesignSize } from '../coordinates.ts'
import type { RenderIconKey } from '../icons.ts'
import type {
  Activity,
  Availability,
  RenderableBubble,
  BubbleUpdate,
  MapFit,
  MapInitialView,
  MapMode,
  MapSettings,
  Skin,
  SkinRule,
} from '../data/types.ts'
import type { VisualState } from '../visualState.ts'

export const DESIGN_WIDTH = 1600
// Used before the background image has loaded (and as the seed aspect ratio
// for any map created without one yet). Once loaded, the real design height
// is DESIGN_WIDTH * image.naturalHeight / image.naturalWidth - see
// MapCanvas.tsx.
export const DEFAULT_DESIGN_HEIGHT = 900

export interface BubbleVisualProps {
  x: number // 0 a 1
  y: number // 0 a 1
  designSize: DesignSize
  visualState: VisualState
  skin: Skin['config']
  icon?: RenderIconKey | null
  label?: string
  draggable?: boolean
  onClick?: () => void
  onHoverChange?: (hovered: boolean) => void
  onDragEnd?: (pos: { x: number; y: number }) => void
  onDragStart?: () => void
  // Bumping this value (e.g. to Date.now()) triggers the same
  // bounce+ring feedback used for a locked->complete transition, without
  // requiring a visual-state change. Used to highlight a bubble picked
  // from the activities overview panel.
  pulseKey?: number
  // Editor only: Moodle does not track this activity's completion.
  warning?: boolean
}

// What the student HUD can ask of the camera.
export interface MapCanvasControls {
  zoomIn: () => void
  zoomOut: () => void
  // Back to the whole map.
  recenter: () => void
  // Back to the map's own starting view (the editor's choice).
  resetToInitial: () => void
}

export interface MapCanvasProps {
  backgroundUrl: string
  bubbles: RenderableBubble[]
  editable: boolean
  // Inside someone else's page (embed): on touch screens one finger scrolls
  // the page until the person opts in to moving the map, and a visible button
  // gives the page back. Without it the canvas would trap every swipe.
  touchGuard?: boolean
  // Overrides the generic default with the level title and progress
  // (built by the caller, which knows both).
  ariaLabel?: string
  fit?: MapFit
  mapMode?: MapMode
  initialView?: MapInitialView | null
  intro?: MapSettings['intro']
  pathSettings?: MapSettings['path']
  ambient?: MapSettings['ambient']
  skins?: Skin[]
  defaultSkinId?: string | null
  skinRules?: SkinRule[]
  onBubbleClick?: (bubble: RenderableBubble) => void
  onBubbleMove?: (bubbleId: string, x: number, y: number) => void
  onBubbleUpdate?: (bubbleId: string, input: BubbleUpdate) => void
  onBubbleDelete?: (bubbleId: string) => void
  onActivityDrop?: (activityId: number, x: number, y: number) => void
  // A content bubble dragged from the palette, and the editor's way to edit one.
  onContentDrop?: (x: number, y: number) => void
  onEditContent?: (bubble: RenderableBubble) => void
  // Student view: a non-null reason makes the bubble non-interactive and is
  // shown as a tooltip on hover.
  getUnavailableReason?: (bubble: RenderableBubble) => string | null
  // Used to derive a default icon (by Moodle modname) for bubbles with no
  // icon of their own, instead of the generic "?", and to resolve a skin
  // rule by activity type.
  getModnameForBubble?: (bubble: RenderableBubble) => string | undefined
  // From GET /course-maps/{id}/resolved, joined by bubbleId.
  getAvailability?: (bubble: RenderableBubble) => Availability | undefined
  getResolvedActivity?: (bubble: RenderableBubble) => Activity | null
  // One-shot request to center the viewport on a bubble and briefly
  // highlight it (from the activities overview panel). MapCanvas calls
  // onFocusHandled once it's done so the same bubble can be re-focused.
  focusBubbleId?: string | null
  onFocusHandled?: () => void
  // Reports the live camera center/zoom on every change (a ref write in
  // the parent, not state - this fires every pan/zoom tick). Backs the
  // appearance studio's "usar vista actual" capture.
  onViewportChange?: (view: MapInitialView) => void
  // The student HUD draws the zoom and recenter buttons itself (in its corner
  // cluster) and drives the camera through this handle; the canvas then omits
  // its own controls.
  controlsRef?: Ref<MapCanvasControls>
  hideControls?: boolean
  // Narrow screens: the "Mover el mapa" button shows only its icon (its label
  // stays for assistive technology) to leave room for the rest of the HUD.
  compactGuard?: boolean
  // The map's own starting view, for resetToInitial; `initialView` may be a
  // resumed one instead.
  homeView?: MapInitialView | null
  // Editor, host speaking v5.4: open the activity's settings page in Moodle.
  onConfigureCompletion?: (bubble: RenderableBubble) => void
  // The teacher's heat map, by bubble id. Absent when it is off.
  heat?: ReadonlyMap<string, BubbleHeat>
}

// What the teacher's heat map draws on one bubble. Plain text and a rate: the
// canvas never sees the counts behind it.
export interface BubbleHeat {
  kind: 'counts' | 'untracked'
  // 0 to 1; 0 for an untracked bubble, which is drawn neutral.
  rate: number
  // Written on the bubble: "63 %", or "Sin seguimiento".
  badge: string
  // The hover and tap text.
  detail: string
}
