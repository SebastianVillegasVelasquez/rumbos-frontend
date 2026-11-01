import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { FileUp, Loader2, TriangleAlert } from 'lucide-react'
import { Button } from '../../components/ui/Button.tsx'
import { Dialog } from '../../components/ui/Dialog.tsx'
import { ProgressBar } from '../../components/ui/Skeleton.tsx'
import { es } from '../../i18n/es.ts'
import { courseMapApi } from '../course-map/data/index.ts'
import { fetchDraftConsistently } from '../course-map/data/draftCache.ts'
import type { CourseMapSummary } from '../course-map/data/types.ts'
import { isContentBubble } from '../content/contentTypes.ts'
import { matchDescriptors } from './matching.ts'
import { ReviewStep } from './ReviewStep.tsx'
import { initReview, reviewReducer, type ReviewAction, type ReviewState } from './reviewState.ts'
import { describeImportError, type ImportFailure } from './transferErrors.ts'
import { learnFromTransferError } from './transferSupport.ts'
import { useCourseTargets } from './useCourseTargets.ts'
import type { ImportApplyResult, ImportStaged } from './types.ts'

const text = es.transfer.import

const EXTENSION = /\.rumbos$/i

type Step =
  | { name: 'upload' }
  | { name: 'uploading'; fileName: string; progress: number }
  | { name: 'preview'; staged: ImportStaged }
  | { name: 'checking'; staged: ImportStaged }
  | { name: 'review'; staged: ImportStaged }
  | { name: 'result'; result: ImportApplyResult }

const STEP_INDEX: Record<Step['name'], number> = {
  upload: 0,
  uploading: 0,
  preview: 1,
  checking: 1,
  review: 2,
  result: 3,
}

interface ImportWizardProps {
  onClose: () => void
  levels: CourseMapSummary[]
  onOpenLevel: (levelId: string) => void
}

const ImportWizard = ({ onClose, levels, onOpenLevel }: ImportWizardProps) => {
  const queryClient = useQueryClient()
  const { targets, pending: targetsPending } = useCourseTargets(levels[0]?.id ?? null, true)
  const [step, setStep] = useState<Step>({ name: 'upload' })
  const [error, setError] = useState<ImportFailure | null>(null)
  const [review, setReview] = useState<ReviewState | null>(null)
  const [unavailable, setUnavailable] = useState<ReadonlySet<number>>(new Set())
  const [rightsDeclared, setRightsDeclared] = useState(false)
  const [applying, setApplying] = useState(false)
  // The staged import to throw away if the editor leaves before applying.
  const stagedId = useRef<string | null>(null)

  const discard = useCallback(() => {
    const id = stagedId.current
    stagedId.current = null
    if (id) void courseMapApi.discardImport(id).catch(() => undefined)
  }, [])

  // Closing the dialog any way (Escape, the X, a route change) cleans up.
  useEffect(() => discard, [discard])

  const fail = (failure: unknown): ImportFailure => {
    learnFromTransferError(failure)
    return describeImportError(failure)
  }

  const restart = (failure: ImportFailure | null) => {
    discard()
    setReview(null)
    setRightsDeclared(false)
    setError(failure)
    setStep({ name: 'upload' })
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    if (!EXTENSION.test(file.name)) return setError({ message: text.upload.wrongType })
    if (file.size === 0) return setError({ message: text.upload.empty })
    setStep({ name: 'uploading', fileName: file.name, progress: 0 })
    try {
      const staged = await courseMapApi.stageImport(file, (progress) =>
        setStep({ name: 'uploading', fileName: file.name, progress })
      )
      stagedId.current = staged.importId
      setStep({ name: 'preview', staged })
    } catch (failure) {
      restart(fail(failure))
    }
  }

  // Activities already on a level cannot be placed again: read every level's
  // draft (after pending edits are saved) and collect their cmids.
  const placedCmids = async (): Promise<Set<number>> => {
    const placed = new Set<number>()
    for (const level of levels) {
      const detail = await fetchDraftConsistently(queryClient, level.id)
      for (const bubble of detail.bubbles)
        if (bubble.activityId !== null && !isContentBubble(bubble)) placed.add(bubble.activityId)
    }
    return placed
  }

  const goReview = async (staged: ImportStaged) => {
    setError(null)
    setStep({ name: 'checking', staged })
    try {
      // Also tells us the staged import is still alive before the editor works on it.
      await courseMapApi.getImport(staged.importId)
      const placed = await placedCmids()
      const matches = matchDescriptors({
        descriptors: staged.preview.descriptors,
        targets,
        placedCmids: placed,
      })
      setUnavailable(placed)
      setReview(initReview(matches))
      setStep({ name: 'review', staged })
    } catch (failure) {
      const described = fail(failure)
      if (described.expired) restart(described)
      else {
        setError(described)
        setStep({ name: 'preview', staged })
      }
    }
  }

  const dispatch = (action: ReviewAction) =>
    setReview((current) => (current ? reviewReducer(current, action) : current))

  const apply = async (staged: ImportStaged) => {
    if (!review) return
    setError(null)
    setApplying(true)
    try {
      const result = await courseMapApi.applyImport(staged.importId, {
        mapping: review.mapping,
        ...(staged.preview.audio.ownTracks.length > 0 && { audioRightsDeclared: rightsDeclared }),
      })
      // Applied: nothing left to discard.
      stagedId.current = null
      void queryClient.invalidateQueries({ queryKey: ['course-maps'] })
      setStep({ name: 'result', result })
    } catch (failure) {
      const described = fail(failure)
      if (described.expired) restart(described)
      else {
        if (described.placedCmid !== undefined) {
          dispatch({ type: 'refused', cmid: described.placedCmid })
          setUnavailable((current) => new Set(current).add(described.placedCmid!))
        }
        setError(described)
      }
    } finally {
      setApplying(false)
    }
  }

  const busy = step.name === 'uploading' || step.name === 'checking' || applying

  const handleOpenChange = (open: boolean) => {
    if (open || busy) return
    onClose()
  }

  return (
    <Dialog open onOpenChange={handleOpenChange} title={text.title} size="lg">
      <ol className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-ink-soft">
        {Object.values(text.steps).map((label, index) => (
          <li
            key={label}
            aria-current={index === STEP_INDEX[step.name] ? 'step' : undefined}
            className={
              index === STEP_INDEX[step.name] ? 'text-ink underline underline-offset-4' : ''
            }
          >
            {index + 1}. {label}
          </li>
        ))}
      </ol>

      {(step.name === 'upload' || step.name === 'uploading') && (
        <UploadStep
          uploading={step.name === 'uploading' ? step : null}
          error={error}
          onFile={(file) => void handleFile(file)}
          onCancel={onClose}
        />
      )}

      {(step.name === 'preview' || step.name === 'checking') && (
        <PreviewStep
          staged={step.staged}
          error={error}
          checking={step.name === 'checking' || targetsPending}
          onNext={() => void goReview(step.staged)}
          onBack={() => restart(null)}
        />
      )}

      {step.name === 'review' && review && (
        <ReviewStep
          preview={step.staged.preview}
          descriptors={step.staged.preview.descriptors}
          targets={targets}
          unavailable={unavailable}
          state={review}
          dispatch={dispatch}
          rightsDeclared={rightsDeclared}
          onRightsChange={setRightsDeclared}
          applying={applying}
          error={error}
          onApply={() => void apply(step.staged)}
          onBack={() => restart(null)}
        />
      )}

      {step.name === 'result' && (
        <ResultStep
          result={step.result}
          onOpen={() => {
            onOpenLevel(step.result.maps[0].id)
            onClose()
          }}
          onClose={onClose}
        />
      )}
    </Dialog>
  )
}

const UploadStep = ({
  uploading,
  error,
  onFile,
  onCancel,
}: {
  uploading: { fileName: string; progress: number } | null
  error: ImportFailure | null
  onFile: (file: File | undefined) => void
  onCancel: () => void
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const percent = uploading ? Math.round(uploading.progress * 100) : 0

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    if (!uploading) onFile(event.dataTransfer.files[0])
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">{text.upload.description}</p>
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center gap-3 rounded-lg border-soft border-dashed p-6 text-center ${
          dragging ? 'bg-primary-tint' : 'bg-surface-muted'
        }`}
      >
        {uploading ? (
          <div className="w-full space-y-2" role="status">
            <p className="break-words text-sm font-bold text-ink">
              {percent < 100 ? text.upload.uploading(uploading.fileName) : text.upload.checking}
            </p>
            <ProgressBar value={percent} max={100} />
            <p className="text-xs font-semibold text-ink-soft">{text.upload.progress(percent)}</p>
          </div>
        ) : (
          <>
            <FileUp size={28} strokeWidth={2.5} aria-hidden className="text-ink-soft" />
            <p className="text-sm font-bold text-ink">{text.upload.drop}</p>
            <p className="text-xs font-semibold text-ink-soft">{text.upload.or}</p>
            <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
              {text.upload.choose}
            </Button>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".rumbos"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            onFile(event.target.files?.[0])
            event.target.value = ''
          }}
        />
      </div>
      {error && <ErrorBlock failure={error} />}
      <div className="flex justify-end">
        <Button type="button" variant="secondary" disabled={uploading !== null} onClick={onCancel}>
          {text.cancel}
        </Button>
      </div>
    </div>
  )
}

const ErrorBlock = ({ failure }: { failure: { message: string; details?: string[] } }) => (
  <div role="alert" className="space-y-1 text-sm font-semibold text-danger">
    <p>{failure.message}</p>
    {failure.details && failure.details.length > 0 && (
      <ul className="list-disc pl-5 font-medium">
        {failure.details.map((line, index) => (
          <li key={index}>{line}</li>
        ))}
      </ul>
    )}
  </div>
)

const PreviewStep = ({
  staged,
  error,
  checking,
  onNext,
  onBack,
}: {
  staged: ImportStaged
  error: ImportFailure | null
  checking: boolean
  onNext: () => void
  onBack: () => void
}) => {
  const { preview } = staged
  const p = text.preview
  const bubbles = preview.maps.reduce((sum, map) => sum + map.bubbleCount, 0)
  const activities = preview.maps.reduce((sum, map) => sum + map.activityBubbles, 0)
  const content = preview.maps.reduce((sum, map) => sum + map.contentBubbles, 0)
  const warnings = preview.warnings.map((warning) => ({
    key: `${warning.code}-${warning.message}`,
    // A code this version does not know falls back to the backend's own text.
    text: (text.warnings as Record<string, string>)[warning.code] ?? warning.message,
  }))

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">{p.intro}</p>
      <ul className="flex flex-wrap gap-2 text-xs font-bold text-ink">
        {[
          p.levels(preview.maps.length),
          p.bubbles(bubbles),
          p.activities(activities),
          p.content(content),
          p.images(preview.assets.count),
          ...(preview.customSkins > 0 ? [p.skins(preview.customSkins)] : []),
        ].map((label) => (
          <li key={label} className="border-soft rounded-pill bg-surface-muted px-3 py-1">
            {label}
          </li>
        ))}
      </ul>
      <ul className="space-y-2">
        {preview.maps.map((map) => (
          <li key={map.ref} className="border-soft rounded-md p-3">
            <p className="break-words text-sm font-bold text-ink">{map.title}</p>
            <p className="text-xs font-medium text-ink-soft">
              {[
                p.bubbles(map.bubbleCount),
                map.hasWelcome ? p.welcome : null,
                map.hasAudio ? p.audio : null,
                map.hasView3d ? p.view3d : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </li>
        ))}
      </ul>

      {(warnings.length > 0 || preview.audio.ownTracks.length > 0) && (
        <div className="border-soft space-y-2 rounded-md bg-surface-muted p-3">
          <p className="flex items-center gap-2 text-sm font-bold text-ink">
            <TriangleAlert size={16} strokeWidth={2.5} aria-hidden />
            {p.warningsTitle}
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
            {warnings.map((warning) => (
              <li key={warning.key}>{warning.text}</li>
            ))}
            {preview.audio.ownTracks.length > 0 && (
              <li>
                <span className="font-bold">{p.ownAudioTitle}.</span> {p.ownAudioNotice}
              </li>
            )}
          </ul>
        </div>
      )}

      <p className="text-sm font-semibold text-ink">{p.noChanges}</p>
      {error && <ErrorBlock failure={error} />}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="secondary"
          className="w-full sm:w-auto"
          disabled={checking}
          onClick={onBack}
        >
          {text.back}
        </Button>
        <Button type="button" className="w-full sm:w-auto" disabled={checking} onClick={onNext}>
          {checking ? (
            <>
              <Loader2 size={16} className="motion-safe:animate-spin" aria-hidden />
              {text.upload.checking}
            </>
          ) : (
            text.next
          )}
        </Button>
      </div>
    </div>
  )
}

const ResultStep = ({
  result,
  onOpen,
  onClose,
}: {
  result: ImportApplyResult
  onOpen: () => void
  onClose: () => void
}) => {
  const warnings = result.warnings.map((warning) => ({
    key: `${warning.code}-${warning.message}`,
    text: (text.warnings as Record<string, string>)[warning.code] ?? warning.message,
  }))
  return (
    <div className="space-y-4">
      <div role="status" className="space-y-1">
        <p className="font-heading text-lg font-extrabold text-ink">{text.result.title}</p>
        <p className="text-sm font-semibold text-ink">
          {text.result.summary(result.maps.length, result.skippedBubbles)}
        </p>
      </div>
      {warnings.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
          {warnings.map((warning) => (
            <li key={warning.key}>{warning.text}</li>
          ))}
        </ul>
      )}
      <p className="border-strong rounded-md bg-accent p-3 text-sm font-bold text-ink">
        {text.result.reminder}
      </p>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={onClose}>
          {text.close}
        </Button>
        {result.maps.length > 0 && (
          <Button type="button" className="w-full sm:w-auto" onClick={onOpen}>
            {text.result.openFirst}
          </Button>
        )}
      </div>
    </div>
  )
}

export default ImportWizard
