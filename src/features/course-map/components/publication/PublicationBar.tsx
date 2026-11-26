import { Suspense, lazy, useState } from 'react'
import { History, Rocket, Undo2 } from 'lucide-react'
import { Button } from '../../../../components/ui/Button.tsx'
import { OverflowMenu, type OverflowItem } from '../../../../components/ui/OverflowMenu.tsx'
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog.tsx'
import { useToast } from '../../../../components/ui/toastContext.ts'
import { es } from '../../../../i18n/es.ts'
import { useDiscardChanges } from '../../data/draftMutations.ts'
import { usePublicationState } from '../../data/queries.ts'
import { isWriteDiscarded } from '../../data/writeQueue.ts'
import type { PublicationStatus, Warning } from '../../data/types.ts'
import { PublishDialog } from './PublishDialog.tsx'
import { WarningsDialog } from './WarningsDialog.tsx'

// The drawer is only needed once someone opens the history.
const HistoryDrawer = lazy(() =>
  import('./HistoryDrawer.tsx').then((m) => ({ default: m.HistoryDrawer }))
)

interface PublicationBarProps {
  courseMapId: string
  // The editor is writing a change right now.
  isSaving?: boolean
  // More rows for the "⋯" menu (the editor's own preferences).
  menuExtra?: readonly OverflowItem[]
}

// One compact status: "● v13 guardado". The dot carries the colour, the words
// carry the meaning. The words give way to the dot alone on the narrowest bars.
const SaveStatus = ({
  status,
  number,
  saving,
}: {
  status: PublicationStatus | null
  number: number | null
  saving: boolean
}) => {
  const copy = es.shell.status
  const [label, dot, aria] = saving
    ? [copy.saving, 'bg-ink-soft', copy.saving]
    : status === null
      ? [copy.loading, 'bg-ink-soft', es.publication.chip.aria.loading]
      : status === 'never_published'
        ? [copy.never, 'bg-ink-soft', es.publication.chip.aria.never]
        : status === 'up_to_date'
          ? [
              copy.upToDate(number ?? 0),
              'bg-leaf-dark',
              es.publication.chip.aria.upToDate(number ?? 0),
            ]
          : [copy.unpublished, 'bg-sun-dark', es.publication.chip.aria.unpublished]
  return (
    <span
      role="status"
      aria-label={aria}
      title={label}
      className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-ink"
    >
      <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
      <span className="max-w-[9.5rem] truncate max-[560px]:hidden">{label}</span>
    </span>
  )
}

// Editor-only controls in the top bar: the status, Guardar (always the primary
// action; off only when there is nothing to save) and the "⋯" menu with
// Versiones guardadas and Descartar cambios.
export const PublicationBar = ({
  courseMapId,
  isSaving = false,
  menuExtra = [],
}: PublicationBarProps) => {
  const toast = useToast()
  const stateQuery = usePublicationState(courseMapId)
  const discard = useDiscardChanges(courseMapId)
  const [publishOpen, setPublishOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [warnings, setWarnings] = useState<Warning[]>([])

  const state = stateQuery.data
  const status = state?.status ?? null
  const discardDisabledReason =
    status === 'never_published'
      ? es.publication.discard.disabledNever
      : status === 'up_to_date'
        ? es.publication.discard.disabledUpToDate
        : null
  const canDiscard = status === 'unpublished_changes'
  const canPublish = status !== 'up_to_date'

  const handleDiscard = () => {
    discard.mutate(undefined, {
      onSuccess: (result) => {
        toast.show(es.publication.discard.done, 'success')
        if (result.warnings.length > 0) setWarnings(result.warnings)
      },
      onError: (error) => {
        if (!isWriteDiscarded(error)) toast.show(es.publication.discard.error, 'error')
      },
    })
  }

  const items: OverflowItem[] = [
    {
      label: es.publication.history.button,
      icon: <History size={16} strokeWidth={2.5} aria-hidden />,
      onSelect: () => setHistoryOpen(true),
    },
    {
      label: es.publication.discard.button,
      icon: <Undo2 size={16} strokeWidth={2.5} aria-hidden />,
      onSelect: () => setDiscardOpen(true),
      disabled: !canDiscard || discard.isPending,
      hint: discardDisabledReason ?? undefined,
    },
    ...menuExtra,
  ]

  return (
    <div
      role="toolbar"
      aria-label={es.publication.publish}
      className="flex items-center gap-1.5 min-[520px]:gap-2"
    >
      <SaveStatus status={status} number={state?.currentNumber ?? null} saving={isSaving} />
      <Button
        type="button"
        size="sm"
        className="min-h-[40px] px-3 disabled:bg-primary disabled:opacity-100 disabled:shadow-none max-[400px]:px-2.5"
        disabled={!canPublish}
        title={!canPublish ? es.publication.publishDisabled : undefined}
        onClick={() => setPublishOpen(true)}
      >
        <Rocket size={16} strokeWidth={2.5} aria-hidden className="max-[400px]:hidden" />
        {es.shell.save}
      </Button>
      <OverflowMenu label={es.shell.more} items={items} />

      {/* Mounted only while open so each opening re-reviews the draft. */}
      {publishOpen && (
        <PublishDialog open onOpenChange={setPublishOpen} courseMapId={courseMapId} />
      )}

      {historyOpen && (
        <Suspense fallback={null}>
          <HistoryDrawer
            open
            onOpenChange={setHistoryOpen}
            courseMapId={courseMapId}
            currentNumber={state?.currentNumber ?? null}
            onWarnings={setWarnings}
          />
        </Suspense>
      )}

      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title={es.publication.discard.title}
        description={es.publication.discard.description(state?.currentNumber ?? null)}
        confirmLabel={es.publication.discard.confirm}
        cancelLabel={es.publication.discard.cancel}
        onConfirm={handleDiscard}
      />

      <WarningsDialog warnings={warnings} onClose={() => setWarnings([])} />
    </div>
  )
}
