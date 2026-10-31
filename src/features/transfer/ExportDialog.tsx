import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/Button.tsx'
import { Dialog } from '../../components/ui/Dialog.tsx'
import { es } from '../../i18n/es.ts'
import { courseMapApi } from '../course-map/data/index.ts'
import { fetchDraftConsistently } from '../course-map/data/draftCache.ts'
import { retryTransient } from '../course-map/data/queryKeys.ts'
import type { CourseMapSummary } from '../course-map/data/types.ts'
import { isContentBubble } from '../content/contentTypes.ts'
import { useEmbed } from '../embed/EmbedContext.ts'
import { useHostCourseName } from '../embed/hostCourse.ts'
import { useHostState } from '../embed/hostState.ts'
import { courseTitleFrom } from '../course-map/courseTitle.ts'
import { descriptorsFor, targetsFromActivities, targetsFromCourseState } from './courseTargets.ts'
import { downloadBlob } from './download.ts'
import { exportFilename } from './exportFilename.ts'
import { describeExportError } from './transferErrors.ts'
import { learnFromTransferError } from './transferSupport.ts'
import type { ExportSource } from './types.ts'

const text = es.transfer.export

export const MAX_EXPORT_LEVELS = 20

const checkboxClass = 'h-5 w-5 shrink-0 accent-primary'

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  levels: CourseMapSummary[]
}

type Phase = { name: 'form' } | { name: 'working' } | { name: 'done'; blob: Blob; filename: string }

const ExportDialog = ({ open, onOpenChange, levels }: ExportDialogProps) => {
  const queryClient = useQueryClient()
  const embed = useEmbed()
  const hostState = useHostState()
  const hostCourseName = useHostCourseName()
  const [selected, setSelected] = useState<Set<string>>(() => new Set(levels.map((l) => l.id)))
  const [source, setSource] = useState<ExportSource>('draft')
  const [includeOwnAudio, setIncludeOwnAudio] = useState(false)
  const [phase, setPhase] = useState<Phase>({ name: 'form' })
  const [error, setError] = useState<string | null>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)

  // Embedded, the host's state lists the activities; standalone, the backend
  // does (through any level of the course).
  const standaloneActivities = useQuery({
    queryKey: ['transfer', 'activities', levels[0]?.id ?? null],
    queryFn: () => courseMapApi.getActivities(levels[0].id, true, false),
    enabled: !embed && open && levels.length > 0,
    retry: retryTransient,
    staleTime: 30_000,
  })
  const targets = useMemo(() => {
    if (embed) return hostState ? targetsFromCourseState(hostState) : []
    return targetsFromActivities(standaloneActivities.data ?? [])
  }, [embed, hostState, standaloneActivities.data])
  const targetsPending = embed ? !hostState : standaloneActivities.isPending

  useEffect(() => {
    if (error) errorRef.current?.focus()
  }, [error])

  const allSelected = levels.length > 0 && selected.size === levels.length
  const tooMany = selected.size > MAX_EXPORT_LEVELS
  const canSubmit = phase.name === 'form' && selected.size > 0 && !tooMany && !targetsPending

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })

  const handleOpenChange = (next: boolean) => {
    if (phase.name === 'working') return
    onOpenChange(next)
  }

  // The activities the chosen levels use, in the version that will be exported.
  // The draft read waits for pending edits to be saved first, so the archive
  // matches what is on screen.
  const usedCmids = async (): Promise<Set<number>> => {
    const cmids = new Set<number>()
    const ordered = levels.filter((level) => selected.has(level.id))
    for (const level of ordered) {
      const bubbles =
        source === 'draft'
          ? (await fetchDraftConsistently(queryClient, level.id)).bubbles
          : (await courseMapApi.getPublishedCourseMap(level.id)).bubbles
      for (const bubble of bubbles)
        if (bubble.activityId !== null && !isContentBubble(bubble)) cmids.add(bubble.activityId)
    }
    return cmids
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    setError(null)
    setPhase({ name: 'working' })
    try {
      const cmids = await usedCmids()
      const blob = await courseMapApi.exportMaps({
        mapIds: levels.filter((level) => selected.has(level.id)).map((level) => level.id),
        source,
        includeOwnAudio,
        activities: descriptorsFor(cmids, targets),
      })
      const filename = exportFilename(hostCourseName ?? courseTitleFrom(levels), new Date())
      downloadBlob(blob, filename)
      setPhase({ name: 'done', blob, filename })
    } catch (failure) {
      learnFromTransferError(failure)
      setError(describeExportError(failure).message)
      setPhase({ name: 'form' })
    }
  }

  const working = phase.name === 'working'

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title={text.title}
      description={text.description}
    >
      {phase.name === 'done' ? (
        <div className="space-y-4">
          <p role="status" className="text-sm font-semibold text-ink">
            <span className="block font-heading text-base font-extrabold">{text.doneTitle}</span>
            {text.done(phase.filename)}
          </p>
          <div className="border-soft space-y-2 rounded-md bg-surface-muted p-3">
            <p className="text-sm font-bold text-ink">{text.blockedTitle}</p>
            <p className="text-sm text-ink-soft">{text.blockedHint}</p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => downloadBlob(phase.blob, phase.filename)}
            >
              <Download size={16} strokeWidth={2.5} aria-hidden />
              {text.retryDownload}
            </Button>
          </div>
          <div className="flex justify-end">
            <Button type="button" onClick={() => onOpenChange(false)}>
              {text.close}
            </Button>
          </div>
        </div>
      ) : (
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault()
            void handleSubmit()
          }}
        >
          <fieldset className="space-y-1" disabled={working}>
            <legend className="mb-1 text-xs font-bold uppercase tracking-wide text-ink">
              {text.levelsLegend}
            </legend>
            <label className="flex min-h-[44px] items-center gap-3 text-sm font-bold text-ink">
              <input
                type="checkbox"
                className={checkboxClass}
                checked={allSelected}
                onChange={() =>
                  setSelected(allSelected ? new Set() : new Set(levels.map((level) => level.id)))
                }
              />
              {text.allLevels}
            </label>
            <ul className="max-h-48 space-y-0.5 overflow-y-auto pl-4">
              {levels.map((level) => (
                <li key={level.id}>
                  <label className="flex min-h-[44px] items-center gap-3 text-sm font-semibold text-ink">
                    <input
                      type="checkbox"
                      className={checkboxClass}
                      checked={selected.has(level.id)}
                      onChange={() => toggle(level.id)}
                    />
                    <span className="min-w-0 truncate">{level.title}</span>
                  </label>
                </li>
              ))}
            </ul>
            {selected.size === 0 && (
              <p className="text-sm font-semibold text-danger">{text.noLevels}</p>
            )}
            {tooMany && (
              <p className="text-sm font-semibold text-danger">
                {text.tooManyLevels(MAX_EXPORT_LEVELS)}
              </p>
            )}
          </fieldset>

          <fieldset className="space-y-1" disabled={working}>
            <legend className="mb-1 text-xs font-bold uppercase tracking-wide text-ink">
              {text.sourceLegend}
            </legend>
            {(
              [
                ['draft', text.sourceDraft, text.sourceDraftHint],
                ['saved', text.sourceSaved, text.sourceSavedHint],
              ] as const
            ).map(([value, label, hint]) => (
              <label
                key={value}
                className="flex min-h-[44px] items-start gap-3 text-sm font-semibold text-ink"
              >
                <input
                  type="radio"
                  name="export-source"
                  className={`${checkboxClass} mt-0.5`}
                  checked={source === value}
                  onChange={() => setSource(value)}
                />
                <span>
                  {label}
                  <span className="block text-xs font-medium text-ink-soft">{hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <label className="flex min-h-[44px] items-start gap-3 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              className={`${checkboxClass} mt-0.5`}
              checked={includeOwnAudio}
              disabled={working}
              aria-describedby="export-audio-notice"
              onChange={(event) => setIncludeOwnAudio(event.target.checked)}
            />
            <span>
              {text.audioLabel}
              <span id="export-audio-notice" className="block text-xs font-medium text-ink-soft">
                {text.audioNotice}
              </span>
            </span>
          </label>

          {error && (
            <p
              ref={errorRef}
              tabIndex={-1}
              role="alert"
              className="text-sm font-semibold text-danger focus:outline-none"
            >
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              disabled={working}
              onClick={() => onOpenChange(false)}
            >
              {text.cancel}
            </Button>
            <Button type="submit" className="w-full sm:w-auto" disabled={!canSubmit}>
              {working ? (
                <>
                  <Loader2 size={16} className="motion-safe:animate-spin" aria-hidden />
                  {text.submitting}
                </>
              ) : targetsPending ? (
                text.preparing
              ) : (
                text.submit
              )}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}

export default ExportDialog
