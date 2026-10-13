import { useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Button } from '../../../../components/ui/Button.tsx'
import { Input } from '../../../../components/ui/Input.tsx'
import { Dialog } from '../../../../components/ui/Dialog.tsx'
import { useToast } from '../../../../components/ui/toastContext.ts'
import { es } from '../../../../i18n/es.ts'
import { ApiError } from '../../data/client.ts'
import { retryTransient } from '../../data/queryKeys.ts'
import { fetchPublicationState, usePublish } from '../../data/queries.ts'
import { describeChanges } from '../../publicationText.ts'

const NOTE_MAX = 200

interface PublishDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  courseMapId: string
}

interface Problem {
  code: string
  message: string
}

const problemsOf = (error: ApiError): Problem[] => {
  const problems = error.detail.problems
  if (!Array.isArray(problems)) return []
  return problems.filter(
    (item): item is Problem =>
      typeof item === 'object' && item !== null && typeof (item as Problem).message === 'string'
  )
}

// Shows what is about to go live and publishes exactly the draft that was
// reviewed: the hash of the reviewed state travels with the request, so a draft
// that changed in the meantime is rejected and re-reviewed instead of published
// unseen.
export const PublishDialog = ({ open, onOpenChange, courseMapId }: PublishDialogProps) => {
  const toast = useToast()
  const publish = usePublish(courseMapId)
  const [note, setNote] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [problems, setProblems] = useState<Problem[]>([])

  // A snapshot of the draft the person is reviewing. It never refetches by
  // itself (staleTime: Infinity, a key unique to this opening), so the hash we
  // send is always the one whose changes were on screen.
  const mountId = useId()
  const reviewQuery = useQuery({
    // Not under the publication-state prefix: invalidating that must not
    // swap the reviewed snapshot for a newer one.
    queryKey: ['publish-review', courseMapId, mountId],
    queryFn: () => fetchPublicationState(courseMapId),
    staleTime: Infinity,
    gcTime: 0,
    retry: retryTransient,
  })
  const state = reviewQuery.data ?? null
  const reviewing = reviewQuery.isFetching
  const loadReview = () => void reviewQuery.refetch()

  const sentences = state?.changes ? describeChanges(state.changes) : []
  const nothingToPublish = state !== null && state.status === 'up_to_date'

  const handleSubmit = () => {
    if (!state) return
    setMessage(null)
    setProblems([])
    publish.mutate(
      { draftHash: state.draftHash, note: note.trim() || undefined },
      {
        onSuccess: (publication) => {
          toast.show(es.publication.published(publication.number), 'success')
          onOpenChange(false)
        },
        onError: (error) => {
          const code = error instanceof ApiError ? error.detail.code : null
          if (code === 'draft_changed_since_review') {
            setMessage(es.publication.dialog.draftChanged)
            loadReview()
          } else if (code === 'no_changes_to_publish') {
            setMessage(es.publication.dialog.noChangesError)
            loadReview()
          } else if (code === 'publish_invalid' && error instanceof ApiError) {
            setProblems(problemsOf(error))
          } else {
            setMessage(es.publication.dialog.genericError)
          }
        },
      }
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={es.publication.dialog.title}
      description={es.publication.dialog.intro}
    >
      <div className="space-y-4">
        {reviewing && (
          <p className="flex items-center gap-2 text-sm text-ink-soft" role="status">
            <Loader2 size={16} strokeWidth={2.5} className="motion-safe:animate-spin" aria-hidden />
            {es.publication.dialog.loading}
          </p>
        )}

        {reviewQuery.isError && !reviewing && (
          <div className="space-y-2" role="alert">
            <p className="text-sm font-semibold text-danger">{es.publication.dialog.loadError}</p>
            <Button size="sm" variant="secondary" onClick={loadReview}>
              {es.publication.dialog.retry}
            </Button>
          </div>
        )}

        {state && !reviewing && (
          <section aria-labelledby="publish-changes-title" className="space-y-2">
            <h3
              id="publish-changes-title"
              className="text-xs font-bold uppercase tracking-wide text-ink-soft"
            >
              {es.publication.dialog.changesTitle}
            </h3>
            {state.status === 'never_published' && (
              <p className="text-sm text-ink">{es.publication.dialog.firstTime}</p>
            )}
            {nothingToPublish && (
              <p className="text-sm text-ink-soft">{es.publication.dialog.noChanges}</p>
            )}
            {sentences.length > 0 && (
              <ul className="list-inside list-disc space-y-1 text-sm text-ink">
                {sentences.map((sentence) => (
                  <li key={sentence} className="break-words">
                    {sentence}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {message && (
          <p
            role="alert"
            className="rounded-md border-soft bg-sun-tint px-3 py-2 text-sm font-semibold text-sun-dark"
          >
            {message}
          </p>
        )}

        {problems.length > 0 && (
          <div
            role="alert"
            className="space-y-1 rounded-md border-soft bg-danger-tint px-3 py-2 text-sm text-danger"
          >
            <p className="font-bold">{es.publication.dialog.invalidTitle}</p>
            <ul className="list-inside list-disc">
              {problems.map((problem) => (
                <li key={problem.code + problem.message} className="break-words">
                  {problem.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        <label className="block space-y-1">
          <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">
            {es.publication.dialog.noteLabel}
          </span>
          <Input
            density="compact"
            type="text"
            value={note}
            maxLength={NOTE_MAX}
            onChange={(e) => setNote(e.target.value)}
            placeholder={es.publication.dialog.notePlaceholder}
          />
          <span className="block text-right text-xs text-ink-soft" aria-live="off">
            {es.publication.dialog.noteCounter(note.length, NOTE_MAX)}
          </span>
        </label>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-2">
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            {es.publication.dialog.cancel}
          </Button>
          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={!state || reviewing || nothingToPublish || publish.isPending}
            onClick={handleSubmit}
          >
            {publish.isPending ? es.publication.dialog.submitting : es.publication.dialog.submit}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
