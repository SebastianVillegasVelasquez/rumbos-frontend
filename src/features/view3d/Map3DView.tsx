import { useRef, useState, useSyncExternalStore } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/Button.tsx'
import { es } from '../../i18n/es.ts'
import type { CssVars, Locale3d, Point3D } from './protocol.ts'
import { useHostTheme3d } from './themeVars.ts'
import { useView3dBridge, type BridgeStatus } from './useView3dBridge.ts'

// The stable seam of the 3D view. Phase 1 renders the 3D page in an iframe;
// a native port can replace this component without touching its callers.
export interface Map3DViewProps {
  scene: string
  locale: Locale3d
  points: Point3D[]
  onPinClick: (pointId: string) => void
  onOpenActivity: (pointId: string) => void
  // Flies the camera to this point; `onFocusHandled` lets the caller clear it
  // so the same point can be focused again.
  focusPointId?: string | null
  onFocusHandled?: () => void
  // Design tokens as --r3d-* variables; defaults to the host's current theme.
  theme?: CssVars
  // Accessible name of the frame (the map's title).
  title: string
  // Offered when the device cannot draw the world at all.
  onBackTo2d?: () => void
}

const prefersReducedMotionQuery = '(prefers-reduced-motion: reduce)'
const subscribeReducedMotion = (notify: () => void) => {
  const query = window.matchMedia(prefersReducedMotionQuery)
  query.addEventListener('change', notify)
  return () => query.removeEventListener('change', notify)
}
const useReducedMotion = () =>
  useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(prefersReducedMotionQuery).matches,
    () => false
  )

// Our own page, same origin, loading only its own assets: scripts and
// same-origin access are needed for exactly that. No top navigation, forms,
// popups or downloads, and no `allow` features.
const FRAME_SANDBOX = 'allow-scripts allow-same-origin'
const FRAME_SRC = `${import.meta.env.BASE_URL}3d/`

const errorMessage = (code: string | null) => {
  switch (code) {
    case 'webgl_unavailable':
      return es.view3d.noWebgl
    case 'timeout':
      return es.view3d.timeout
    case 'scene_unknown':
      return es.view3d.sceneUnknown
    default:
      return es.view3d.loadError
  }
}

const Map3DFrame = ({
  scene,
  locale,
  points,
  onPinClick,
  onOpenActivity,
  focusPointId = null,
  onFocusHandled,
  theme,
  title,
  onBackTo2d,
  onRetry,
}: Map3DViewProps & { onRetry: () => void }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const hostTheme = useHostTheme3d()
  const reducedMotion = useReducedMotion()
  const { status, errorCode } = useView3dBridge({
    iframeRef,
    scene,
    locale,
    reducedMotion,
    cssVars: theme ?? hostTheme,
    points,
    focusPointId,
    onPinClick,
    onOpenActivity,
    onFocusHandled,
  })

  return (
    <div className="border-strong relative h-full min-h-[320px] w-full overflow-hidden rounded-md bg-surface-muted">
      <iframe
        ref={iframeRef}
        src={FRAME_SRC}
        title={title}
        sandbox={FRAME_SANDBOX}
        referrerPolicy="no-referrer"
        className="absolute inset-0 h-full w-full border-0"
      />
      <FrameOverlay
        status={status}
        errorCode={errorCode}
        onRetry={onRetry}
        onBackTo2d={onBackTo2d}
      />
    </div>
  )
}

const FrameOverlay = ({
  status,
  errorCode,
  onRetry,
  onBackTo2d,
}: {
  status: BridgeStatus
  errorCode: string | null
  onRetry: () => void
  onBackTo2d?: () => void
}) => {
  if (status === 'ready') return null
  if (status === 'loading') {
    return (
      <div
        role="status"
        className="absolute inset-0 flex items-center justify-center gap-2 bg-surface-muted text-sm font-semibold text-ink-soft"
      >
        <Loader2 size={18} strokeWidth={3} className="motion-safe:animate-spin" aria-hidden />
        {es.view3d.loading}
      </div>
    )
  }
  // A device without WebGL will not get better by retrying.
  const canRetry = errorCode !== 'webgl_unavailable'
  return (
    <div
      role="alert"
      className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-muted p-6 text-center"
    >
      <p className="text-sm font-semibold text-ink">{errorMessage(errorCode)}</p>
      <div className="flex flex-wrap justify-center gap-3">
        {canRetry && (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            {es.view3d.retry}
          </Button>
        )}
        {onBackTo2d && (
          <Button size="sm" variant="surface" onClick={onBackTo2d}>
            {es.view3d.backTo2d}
          </Button>
        )}
      </div>
    </div>
  )
}

// A retry remounts the frame (new key), which restarts the handshake, the
// 10 s timer and the iframe itself.
const Map3DView = (props: Map3DViewProps) => {
  const [attempt, setAttempt] = useState(0)
  return <Map3DFrame key={attempt} {...props} onRetry={() => setAttempt((n) => n + 1)} />
}

export default Map3DView
