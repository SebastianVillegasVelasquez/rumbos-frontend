// Types for the API world.js exposes to main.ts. world.js itself is the
// delivered world code (plain JS, deliberately not type-checked).
import type {
  CameraAction,
  Insets,
  Locale3d,
  PinState,
  Point3D,
} from '../src/features/view3d/protocol.ts'

export function setCallbacks(callbacks: {
  onPinClick?: (pointId: string) => void
  onOpenActivity?: (pointId: string) => void
  onCameraState?: (state: { canZoomIn: boolean; canZoomOut: boolean }) => void
}): void
export function setPoints(points: Point3D[]): void
export function setStates(states: Record<string, PinState>): void
export function setLocale(locale: Locale3d): void
export function focusPoint(pointId: string): void
export function setReducedMotion(on: boolean): void
export function releaseIntro(): void
export function setBare(on: boolean): void
export function setInsets(insets: Insets | null): void
export function cameraCommand(action: CameraAction): void
export function dispose(): void
