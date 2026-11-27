import { ExternalLink, Info } from 'lucide-react'
import { Button } from '../../../components/ui/Button.tsx'
import { es } from '../../../i18n/es.ts'
import { FlowStatus } from './FlowStatus.tsx'

// What a preview or a simulation shows where a student would open something in Moodle. Nothing
// is opened or asked by looking at it. Opening for real is a separate button that says what it
// does, since Moodle records the view on the editor's own account.
export const PreviewActivity = ({
  title,
  detail,
  onOpenForReal,
}: {
  title: string
  detail?: string | null
  // Absent outside Moodle, where there is nothing to open.
  onOpenForReal?: () => void
}) => (
  <section
    aria-label={title}
    data-testid="preview-activity"
    className="border-soft flex flex-col items-start gap-3 rounded-lg bg-surface p-4 text-ink"
  >
    <p className="text-lg font-bold">{title}</p>
    {detail && <p className="text-sm font-semibold text-ink-soft">{detail}</p>}
    <FlowStatus icon={<Info size={18} strokeWidth={2.5} />} className="text-base text-ink">
      {es.flow.previewActivity.placeholder}
    </FlowStatus>
    {onOpenForReal && (
      <Button variant="surface" size="sm" onClick={onOpenForReal}>
        <ExternalLink size={16} strokeWidth={2.5} aria-hidden />
        {es.flow.previewActivity.openForReal}
      </Button>
    )}
  </section>
)
