import type { CSSProperties, ReactNode, Ref } from 'react'
import { videoFrameAttributes } from './videoFrame.ts'

interface VideoFrameProps {
  src: string
  title: string
  frameRef?: Ref<HTMLIFrameElement>
  onLoad?: () => void
  // The look of the box that holds the iframe.
  frameClassName: string
  frameStyle?: CSSProperties
  // Optional row under the video (the curtain's "Saltar" and "Empezar viaje").
  actions?: ReactNode
  actionsClassName?: string
}

// A video iframe in a box the caller sizes, plus an optional row of actions.
// Fullscreen is the player's own button: the shared iframe attributes delegate it.
export const VideoFrame = ({
  src,
  title,
  frameRef,
  onLoad,
  frameClassName,
  frameStyle,
  actions,
  actionsClassName = 'flex flex-wrap items-center justify-center gap-3',
}: VideoFrameProps) => (
  <>
    <div className={frameClassName} style={frameStyle}>
      <iframe
        ref={frameRef}
        src={src}
        title={title}
        className="absolute inset-0 h-full w-full border-0"
        {...videoFrameAttributes()}
        onLoad={onLoad}
      />
    </div>
    {actions && <div className={actionsClassName}>{actions}</div>}
  </>
)
