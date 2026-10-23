import { useEffect, useId, useRef, useState } from 'react'
import { es } from '../../../i18n/es.ts'
import { Button } from '../../../components/ui/Button.tsx'
import { API_BASE_URL } from '../../course-map/data/client.ts'
import {
  WIDGET_DEFAULT_HEIGHT_PX,
  assetsOrigin,
  parseWidgetMessage,
  widgetFrameAttributes,
} from './sandbox.ts'

// Messages from the frame are cheap to ignore but not free; a widget that
// floods the page gets a handful through per second.
const MIN_MESSAGE_GAP_MS = 100

interface WidgetFrameProps {
  title: string
  altText: string
  html: string
  // Called when the widget asks to close (the viewer closes its dialog).
  onClose?: () => void
}

// The only component that runs author code. All the security-relevant choices
// live in sandbox.ts; this file only wires them to a frame.
export const WidgetFrame = ({ title, altText, html, onClose }: WidgetFrameProps) => {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const lastMessageAt = useRef(0)
  const [height, setHeight] = useState(WIDGET_DEFAULT_HEIGHT_PX)
  const [described, setDescribed] = useState(false)
  const descriptionId = useId()
  const text = es.content.viewer

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const message = parseWidgetMessage(event, frameRef.current?.contentWindow)
      if (!message) return
      const now = performance.now()
      if (now - lastMessageAt.current < MIN_MESSAGE_GAP_MS) return
      lastMessageAt.current = now
      if (message.type === 'close') onClose?.()
      else setHeight(message.height)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [onClose])

  const attributes = widgetFrameAttributes(html, assetsOrigin(API_BASE_URL, window.location.origin))

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">{text.widgetLabel}</p>
      <iframe
        ref={frameRef}
        title={text.widgetFrameTitle(title)}
        aria-describedby={descriptionId}
        sandbox={attributes.sandbox}
        srcDoc={attributes.srcDoc}
        referrerPolicy={attributes.referrerPolicy}
        className="border-soft w-full rounded-md bg-white"
        style={{ height }}
      />
      <div>
        <Button
          variant="secondary"
          size="sm"
          aria-expanded={described}
          aria-controls={descriptionId}
          onClick={() => setDescribed((value) => !value)}
        >
          {described ? text.widgetDescriptionHide : text.widgetDescription}
        </Button>
        {/* Always in the page for screen readers (aria-describedby above); shown
            to everyone on request. */}
        <p id={descriptionId} className={described ? 'mt-2 text-sm text-ink' : 'sr-only'}>
          {altText}
        </p>
      </div>
    </div>
  )
}
