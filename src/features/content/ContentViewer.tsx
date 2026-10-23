import { Dialog } from '../../components/ui/Dialog.tsx'
import { es } from '../../i18n/es.ts'
import { ContentBlocks } from './ContentBlocks.tsx'
import type { Content } from './contentTypes.ts'
import { WidgetFrame } from './widget/WidgetFrame.tsx'

interface ContentViewerProps {
  content: Content | null
  // From /auth/me. An existing widget does not run once the tenant stops
  // allowing them.
  widgetsEnabled: boolean
  onClose: () => void
}

// The student-facing modal for a content bubble. It lives inside the app (the
// host is not told it opened or closed). Dialog gives it dialog semantics, a
// focus trap, Escape and focus returning to where it came from.
export const ContentViewer = ({ content, widgetsEnabled, onClose }: ContentViewerProps) => {
  if (!content) return null
  const text = es.content.viewer
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title={content.title} size="lg">
      {content.type === 'blocks' ? (
        <ContentBlocks blocks={content.body.blocks} />
      ) : widgetsEnabled ? (
        <WidgetFrame
          title={content.title}
          altText={content.altText}
          html={content.html}
          onClose={onClose}
        />
      ) : (
        <div role="status" className="border-soft rounded-md bg-surface-muted p-3">
          <p className="font-heading text-base font-bold text-ink">{text.widgetDisabledTitle}</p>
          <p className="text-sm text-ink-soft">{text.widgetDisabled}</p>
        </div>
      )}
    </Dialog>
  )
}

export default ContentViewer
