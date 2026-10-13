import * as RadixDialog from '@radix-ui/react-dialog'
import { ExternalLink, X } from 'lucide-react'
import type { Activity } from '../data/types.ts'
import { isSafeActivityUrl } from '../activityOpener.ts'
import { es } from '../../../i18n/es.ts'

interface ActivityModalProps {
  activity: Activity | null
  onClose: () => void
}

export const ActivityModal = ({ activity, onClose }: ActivityModalProps) => {
  const isOpen = activity !== null && isSafeActivityUrl(activity.url)

  return (
    <RadixDialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-ink/50" />
        <RadixDialog.Content className="fixed left-1/2 top-1/2 z-50 flex h-[calc(100dvh-2.5rem)] w-[min(calc(100vw-2.5rem),64rem)] sm:h-[80dvh] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden border-strong rounded-lg bg-surface shadow-lg focus:outline-none">
          <div className="flex items-center justify-between gap-3 border-b-soft px-3 py-3 sm:px-4">
            <RadixDialog.Title className="min-w-0 truncate font-heading font-extrabold text-ink">
              {activity?.name}
            </RadixDialog.Title>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              {activity && (
                <a
                  href={activity.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={es.activityModal.openInNewTab}
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 text-sm font-bold text-primary underline-offset-2 hover:underline"
                >
                  <ExternalLink size={16} strokeWidth={2.5} aria-hidden />
                  <span className="hidden sm:inline">{es.activityModal.openInNewTab}</span>
                </a>
              )}
              <RadixDialog.Close
                aria-label={es.activityModal.close}
                className="border-soft inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-surface text-ink hover:bg-accent"
              >
                <X size={20} strokeWidth={3} />
              </RadixDialog.Close>
            </div>
          </div>
          {activity && (
            <iframe src={activity.url} title={activity.name} className="min-h-0 w-full flex-1" />
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
