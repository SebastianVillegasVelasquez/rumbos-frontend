import * as RadixDialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'md' | 'lg'
}

export const Dialog = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
}: DialogProps) => (
  <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-40 bg-ink/50" />
      <RadixDialog.Content
        className={`fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-3rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border-strong rounded-lg bg-surface p-4 shadow-lg focus:outline-none sm:p-6 ${
          size === 'lg' ? 'w-[min(calc(100vw-2.5rem),60rem)]' : 'w-[min(calc(100vw-2.5rem),32rem)]'
        }`}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <RadixDialog.Title className="font-heading text-xl font-extrabold text-ink">
              {title}
            </RadixDialog.Title>
            {description && (
              <RadixDialog.Description className="mt-1 text-sm text-ink-soft">
                {description}
              </RadixDialog.Description>
            )}
          </div>
          <RadixDialog.Close
            aria-label="Cerrar"
            className="border-soft inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-surface text-ink hover:bg-accent"
          >
            <X size={20} strokeWidth={3} />
          </RadixDialog.Close>
        </div>
        {children}
        {footer && <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div>}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  </RadixDialog.Root>
)
