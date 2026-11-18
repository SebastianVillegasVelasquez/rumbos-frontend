import { forwardRef } from 'react'
import { AlertCircle, X } from 'lucide-react'
import { es } from '../../../i18n/es.ts'
import { IconButton } from '../../../components/ui/Button.tsx'
import { describeIssue, describeWarning, type SettingsIssue } from './settingsIssues.ts'

const copy = es.studio.training.issues

interface SettingsIssuesProps {
  issues: readonly SettingsIssue[]
  stepTitle: (index: number) => string | undefined
  // Move the focus to the field the issue is about.
  onGo: (issue: SettingsIssue) => void
}

// The failing fields of a save, in the author's words. Each line is a button that
// takes you to its field. The region takes the focus itself when no field can.
export const SettingsIssuesList = forwardRef<HTMLDivElement, SettingsIssuesProps>(
  ({ issues, stepTitle, onGo }, ref) => (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      className="mx-4 mb-3 rounded-md bg-danger-tint p-3 text-xs font-bold text-danger outline-none focus-visible:ring-2 focus-visible:ring-danger"
    >
      <p className="flex items-center gap-1.5">
        <AlertCircle size={16} strokeWidth={2.5} aria-hidden className="shrink-0" />
        {copy.title}
      </p>
      <ul className="mt-1.5 list-disc space-y-1 pl-6">
        {issues.map((issue) => (
          <li key={`${issue.path}-${issue.messageKey}`}>
            <button
              type="button"
              title={copy.goTo}
              onClick={() => onGo(issue)}
              className="min-h-[28px] text-left underline underline-offset-2"
            >
              {describeIssue(issue, copy, stepTitle)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
)
SettingsIssuesList.displayName = 'SettingsIssuesList'

// What the server accepted but wants the author to know. It never blocks.
export const SettingsWarnings = ({
  warnings,
  stepTitle,
  onDismiss,
}: {
  warnings: readonly SettingsIssue[]
  stepTitle: (index: number) => string | undefined
  onDismiss: () => void
}) => (
  <div
    role="status"
    className="mx-4 mb-3 rounded-md bg-sun-tint p-3 text-xs font-bold text-sun-dark"
  >
    <div className="flex items-start justify-between gap-2">
      <p>{copy.warningsTitle}</p>
      <IconButton aria-label={es.app.close} variant="ghost" onClick={onDismiss}>
        <X size={16} strokeWidth={3} aria-hidden />
      </IconButton>
    </div>
    <ul className="list-disc space-y-1 pl-5">
      {warnings.map((warning) => (
        <li key={`${warning.path}-${warning.messageKey}`}>
          {describeWarning(warning, copy, stepTitle)}
        </li>
      ))}
    </ul>
  </div>
)
