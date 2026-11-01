import { useEffect, useMemo, useState, type Dispatch } from 'react'
import { CheckCheck, CircleAlert, CircleCheck, CircleHelp, CircleMinus } from 'lucide-react'
import { Button } from '../../components/ui/Button.tsx'
import { Select } from '../../components/ui/Select.tsx'
import { es } from '../../i18n/es.ts'
import { rankCandidates, type Descriptor, type Target } from './matching.ts'
import { isDoubtful, summarize, type ReviewAction, type ReviewState } from './reviewState.ts'
import type { ImportPreview } from './types.ts'

const text = es.transfer.import.review

const checkboxClass = 'h-5 w-5 shrink-0 accent-primary'

type RowStatus = 'exact' | 'similar' | 'none' | 'reviewed' | 'chosen' | 'omitted'

const STATUS_ICON = {
  exact: CircleCheck,
  reviewed: CircleCheck,
  chosen: CircleCheck,
  similar: CircleHelp,
  none: CircleAlert,
  omitted: CircleMinus,
} as const

const STATUS_TONE: Record<RowStatus, string> = {
  exact: 'text-leaf-dark',
  reviewed: 'text-leaf-dark',
  chosen: 'text-leaf-dark',
  similar: 'text-ink',
  none: 'text-ink-soft',
  omitted: 'text-ink-soft',
}

// What the row says about itself, in words (never color alone).
const statusOf = (state: ReviewState, key: string): RowStatus => {
  const cmid = state.mapping[key]
  const match = state.matches.find((item) => item.key === key)
  if (cmid === null || cmid === undefined) return match?.confidence === 'none' ? 'none' : 'omitted'
  if (match?.cmid === cmid) {
    if (match.confidence === 'exact') return 'exact'
    return state.reviewed.has(key) ? 'reviewed' : 'similar'
  }
  return 'chosen'
}

interface ReviewStepProps {
  preview: ImportPreview
  descriptors: Descriptor[]
  targets: Target[]
  // Activities already on a level, or refused by the backend.
  unavailable: ReadonlySet<number>
  state: ReviewState
  dispatch: Dispatch<ReviewAction>
  rightsDeclared: boolean
  onRightsChange: (declared: boolean) => void
  applying: boolean
  error: { message: string; details?: string[] } | null
  onApply: () => void
  onBack: () => void
}

export const ReviewStep = ({
  preview,
  descriptors,
  targets,
  unavailable,
  state,
  dispatch,
  rightsDeclared,
  onRightsChange,
  applying,
  error,
  onApply,
  onBack,
}: ReviewStepProps) => {
  const [onlyDoubtful, setOnlyDoubtful] = useState(false)
  const needsRights = preview.audio.ownTracks.length > 0
  const summary = summarize(state, !needsRights || rightsDeclared)
  const mapTitle = useMemo(
    () => new Map(preview.maps.map((map) => [map.ref, map.title])),
    [preview.maps]
  )

  // After the backend refused a row's activity, take the editor to that row.
  useEffect(() => {
    if (!state.highlightKey) return
    document.getElementById(`import-select-${state.highlightKey}`)?.focus()
  }, [state.highlightKey])

  const visible = onlyDoubtful
    ? descriptors.filter((d) => isDoubtful(state, d.key, summary.duplicated))
    : descriptors

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">{text.intro}</p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p role="status" aria-live="polite" className="text-sm font-bold text-ink">
          {text.counter(summary.matched, summary.doubtful, summary.omitted)}
        </p>
        <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-ink">
          <input
            type="checkbox"
            className={checkboxClass}
            checked={onlyDoubtful}
            onChange={(event) => setOnlyDoubtful(event.target.checked)}
          />
          {text.onlyDoubtful}
        </label>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={applying}
          onClick={() => dispatch({ type: 'acceptExact' })}
        >
          <CheckCheck size={16} strokeWidth={2.5} aria-hidden />
          {text.acceptExact}
        </Button>
      </div>

      <div role="table" aria-label={text.tableLabel} className="border-soft rounded-md">
        <div
          role="row"
          className="hidden grid-cols-2 gap-3 border-b-soft bg-surface-muted px-3 py-2 text-xs font-bold uppercase tracking-wide text-ink sm:grid"
        >
          <span role="columnheader">{text.inFile}</span>
          <span role="columnheader">{text.inCourse}</span>
        </div>
        <div role="rowgroup" className="max-h-[40dvh] divide-y divide-ink/10 overflow-y-auto">
          {visible.length === 0 && (
            <p className="p-3 text-sm font-semibold text-ink-soft">{text.nothingToShow}</p>
          )}
          {visible.map((descriptor) => {
            const key = descriptor.key
            const cmid = state.mapping[key] ?? null
            const status = statusOf(state, key)
            const Icon = STATUS_ICON[status]
            const shared = cmid !== null && summary.duplicated.has(cmid)
            const highlighted = state.highlightKey === key
            const problem = highlighted ? text.placedTarget : shared ? text.sharedTarget : null
            const candidates = rankCandidates(descriptor, targets, unavailable)
            const doubtful = isDoubtful(state, key, summary.duplicated)
            return (
              <div
                key={key}
                role="row"
                className={`grid gap-2 px-3 py-3 sm:grid-cols-2 sm:gap-3 ${
                  problem ? 'bg-danger-tint' : ''
                }`}
              >
                <div role="cell" className="min-w-0">
                  <p className="break-words text-sm font-bold text-ink">{descriptor.name}</p>
                  <p className="text-xs font-medium text-ink-soft">
                    {descriptor.modname} ·{' '}
                    {text.inSection(descriptor.sectionName, descriptor.positionInSection)}
                    {mapTitle.size > 1 && mapTitle.get(descriptor.mapRef)
                      ? ` · ${mapTitle.get(descriptor.mapRef)}`
                      : ''}
                  </p>
                </div>
                <div role="cell" className="min-w-0 space-y-1.5">
                  <Select
                    id={`import-select-${key}`}
                    aria-label={text.rowLabel(descriptor.name)}
                    aria-invalid={problem ? true : undefined}
                    aria-describedby={problem ? `import-problem-${key}` : undefined}
                    disabled={applying}
                    value={cmid === null ? '' : String(cmid)}
                    onChange={(event) =>
                      dispatch({
                        type: 'choose',
                        key,
                        cmid: event.target.value === '' ? null : Number(event.target.value),
                      })
                    }
                  >
                    <option value="">{text.omit}</option>
                    {candidates.map((target) => (
                      <option key={target.cmid} value={target.cmid}>
                        {target.name} ({target.modname}, {target.sectionName})
                      </option>
                    ))}
                  </Select>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-bold ${STATUS_TONE[status]}`}
                    >
                      <Icon size={16} strokeWidth={2.5} aria-hidden />
                      {text.confidence[status]}
                    </span>
                    {doubtful && cmid !== null && !problem && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={text.confirmAria(descriptor.name)}
                        disabled={applying}
                        onClick={() => dispatch({ type: 'confirm', key })}
                      >
                        {text.confirm}
                      </Button>
                    )}
                  </div>
                  {problem && (
                    <p
                      id={`import-problem-${key}`}
                      role="alert"
                      className="text-xs font-bold text-danger"
                    >
                      {problem}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {targets.length > 0 && unavailable.size >= targets.length && (
        <p className="text-sm font-semibold text-ink-soft">{text.noCandidates}</p>
      )}

      {needsRights && (
        <fieldset className="border-soft space-y-2 rounded-md p-3">
          <legend className="px-1 text-xs font-bold uppercase tracking-wide text-ink">
            {text.rightsTitle}
          </legend>
          <ul className="space-y-1 text-sm text-ink">
            {preview.audio.ownTracks.map((track, index) => (
              <li key={index}>
                <span className="font-bold">{track.title}</span>
                {track.credit && (
                  <span className="text-ink-soft">
                    {' '}
                    · {es.transfer.import.preview.credit(track.credit)}
                  </span>
                )}
                {track.license && (
                  <span className="text-ink-soft">
                    {' '}
                    · {es.transfer.import.preview.license(track.license)}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <label className="flex min-h-[44px] items-start gap-3 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              required
              className={`${checkboxClass} mt-0.5`}
              checked={rightsDeclared}
              disabled={applying}
              onChange={(event) => onRightsChange(event.target.checked)}
            />
            {text.rightsLabel}
          </label>
          {!rightsDeclared && (
            <p className="text-xs font-semibold text-ink-soft">{text.rightsRequired}</p>
          )}
        </fieldset>
      )}

      {error && (
        <div role="alert" className="space-y-1 text-sm font-semibold text-danger">
          <p>{error.message}</p>
          {error.details && error.details.length > 0 && (
            <ul className="list-disc pl-5">
              {error.details.map((line, index) => (
                <li key={index}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {summary.duplicated.size > 0 && (
        <p className="text-sm font-semibold text-danger">{text.sharedBlocks}</p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="secondary"
          className="w-full sm:w-auto"
          disabled={applying}
          onClick={onBack}
        >
          {es.transfer.import.back}
        </Button>
        <Button
          type="button"
          className="w-full sm:w-auto"
          disabled={!summary.canApply || applying}
          onClick={onApply}
        >
          {applying ? text.applying : text.apply}
        </Button>
      </div>
    </div>
  )
}
