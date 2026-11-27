import { AlertCircle } from 'lucide-react'
import { useId } from 'react'
import { Input } from '../../../components/ui/Input.tsx'
import { esCongratulations } from '../../../i18n/congratulations.es.ts'
import { es } from '../../../i18n/es.ts'
import type { MapCongratulationsText } from '../../course-map/data/types.ts'
import { CONGRATULATIONS_LIMITS } from '../congratulations.ts'
import { issueMessage, normalizePath, type SettingsIssue } from './settingsIssues.ts'

// The three fields of one journey text (title, message, button), each with its counter and,
// after a refused save, what the server said about it. Shared by the congratulations texts and
// the journey's other texts, which have the same fields and limits.

const text = esCongratulations.editor
export const labelClass = 'text-xs font-bold uppercase tracking-wide text-ink-soft'
const areaClass =
  'border-soft min-h-[88px] w-full rounded-md bg-surface px-3 py-2 text-sm font-semibold text-ink'

const FIELDS = ['title', 'body', 'ctaLabel'] as const

export const TextBlockFields = ({
  path,
  value,
  helpId,
  issues,
  onChange,
}: {
  // The block's path in the settings: where an error says it belongs.
  path: string
  value: MapCongratulationsText
  helpId: string
  issues: readonly SettingsIssue[]
  onChange: (field: keyof MapCongratulationsText, value: string) => void
}) => {
  const base = useId()
  return (
    <>
      {FIELDS.map((field) => {
        const fieldPath = `${path}.${field}`
        const id = `${base}-${field}`
        const errorId = `${id}-error`
        const issue = issues.find((candidate) => normalizePath(candidate.path) === fieldPath)
        const error = issue ? issueMessage(issue, es.studio.training.issues) : null
        const props = {
          id,
          maxLength: CONGRATULATIONS_LIMITS[field],
          value: value[field] ?? '',
          'data-field-path': fieldPath,
          'aria-invalid': error !== null ? true : undefined,
          'aria-describedby': error !== null ? `${errorId} ${helpId}` : helpId,
        }
        return (
          <div key={field} className="space-y-1">
            <label htmlFor={id} className={labelClass}>
              {text[field]}
            </label>
            {field === 'body' ? (
              <textarea
                {...props}
                rows={3}
                className={areaClass}
                onChange={(event) => onChange(field, event.target.value)}
              />
            ) : (
              <Input
                {...props}
                density="compact"
                onChange={(event) => onChange(field, event.target.value)}
              />
            )}
            <span className="text-xs font-semibold text-ink-soft" aria-hidden>
              {text.counter((value[field] ?? '').length, CONGRATULATIONS_LIMITS[field])}
            </span>
            {error !== null && (
              <p id={errorId} className="flex items-start gap-1.5 text-xs font-bold text-danger">
                <AlertCircle size={14} strokeWidth={2.5} aria-hidden className="mt-0.5 shrink-0" />
                <span>
                  <span className="sr-only">{es.studio.training.fieldError}: </span>
                  {error}
                </span>
              </p>
            )}
          </div>
        )
      })}
    </>
  )
}
