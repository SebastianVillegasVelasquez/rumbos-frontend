import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import { Button } from '../../components/ui/Button.tsx'
import { es } from '../../i18n/es.ts'
import { RESERVED_CORNER_PX, useHostFullscreen } from '../embed/hostFullscreen.ts'
import { videoFrameAttributes } from './videoFrame.ts'

const text = es.video

interface EnlargeableVideoProps {
  src: string
  title: string
  frameRef?: Ref<HTMLIFrameElement>
  onLoad?: () => void
  // The look of the frame while it sits in the page.
  frameClassName: string
  frameStyle?: CSSProperties
  // Sits next to "Ampliar video" while the video is in the page.
  actions?: ReactNode
  actionsClassName?: string
}

// A video iframe plus a fallback that always works: "Ampliar video" fills the
// app's own viewport with the player, whether or not native fullscreen is
// available (the host's iframe may not delegate it). The player letterboxes
// itself, so a square or vertical video is limited by height and the 16:9 one
// by width, with no aspect ratio to know. The iframe never changes parent, so
// the video keeps playing through the change. Escape or "Reducir" go back.
export const EnlargeableVideo = ({
  src,
  title,
  frameRef,
  onLoad,
  frameClassName,
  frameStyle,
  actions,
  actionsClassName = 'flex flex-wrap items-center justify-center gap-3',
}: EnlargeableVideoProps) => {
  const [enlarged, setEnlarged] = useState(false)
  const hostFullscreen = useHostFullscreen()
  const enlargeRef = useRef<HTMLButtonElement>(null)
  const shrinkRef = useRef<HTMLButtonElement>(null)
  const changed = useRef(false)

  // Focus follows the button that replaces the one just pressed.
  useEffect(() => {
    if (!changed.current) return
    if (enlarged) shrinkRef.current?.focus()
    else enlargeRef.current?.focus()
  }, [enlarged])

  // In capture so a dialog around the video does not close under Escape.
  useEffect(() => {
    if (!enlarged) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setEnlarged(false)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [enlarged])

  const toggle = (next: boolean) => {
    changed.current = true
    setEnlarged(next)
  }

  return (
    <div
      role={enlarged ? 'dialog' : undefined}
      aria-modal={enlarged ? true : undefined}
      aria-label={enlarged ? title : undefined}
      className={enlarged ? 'fixed inset-0 z-[80] flex flex-col gap-2 bg-black' : 'contents'}
      style={
        enlarged
          ? {
              paddingTop: 'max(0.5rem, env(safe-area-inset-top, 0px))',
              paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))',
              paddingLeft: 'max(0.5rem, env(safe-area-inset-left, 0px))',
              paddingRight: 'max(0.5rem, env(safe-area-inset-right, 0px))',
            }
          : undefined
      }
    >
      {enlarged && (
        // The strip keeps the host's top-right exit control off the player's
        // own top-right buttons; "Reducir" sits at the left.
        <div
          className="flex shrink-0 items-center"
          style={{ minHeight: hostFullscreen ? RESERVED_CORNER_PX - 8 : undefined }}
        >
          <Button ref={shrinkRef} variant="surface" size="sm" dense onClick={() => toggle(false)}>
            <Minimize2 size={16} strokeWidth={2.5} aria-hidden />
            {text.shrink}
          </Button>
        </div>
      )}
      <div
        className={enlarged ? 'relative min-h-0 w-full flex-1' : frameClassName}
        style={enlarged ? undefined : frameStyle}
      >
        <iframe
          ref={frameRef}
          src={src}
          title={title}
          className="absolute inset-0 h-full w-full border-0"
          {...videoFrameAttributes()}
          onLoad={onLoad}
        />
      </div>
      {!enlarged && (
        <div className={actionsClassName}>
          <Button ref={enlargeRef} variant="surface" size="sm" dense onClick={() => toggle(true)}>
            <Maximize2 size={16} strokeWidth={2.5} aria-hidden />
            {text.enlarge}
          </Button>
          {actions}
        </div>
      )}
    </div>
  )
}
