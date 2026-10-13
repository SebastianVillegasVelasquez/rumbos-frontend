import * as RadixDialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { es } from '../../i18n/es.ts'

interface DrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
}

// A right-hand panel built on the same Radix dialog primitive as Dialog, so
// focus is trapped, Escape closes it and focus returns to the trigger.
export const Drawer = ({ open, onOpenChange, title, description, children }: DrawerProps) => (
  <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-40 bg-ink/50" />
      <RadixDialog.Content
        {...(description ? {} : { 'aria-describedby': undefined })}
        className="fixed inset-y-0 right-0 z-50 flex h-dvh w-full max-w-full sm:max-w-md flex-col border-l-strong bg-surface focus:outline-none"
      >
        <div className="flex items-start justify-between gap-4 border-b-soft px-4 py-3">
          <div className="min-w-0">
            <RadixDialog.Title className="font-heading text-lg font-extrabold text-ink">
              {title}
            </RadixDialog.Title>
            {description && (
              <RadixDialog.Description className="mt-0.5 text-xs text-ink-soft">
                {description}
              </RadixDialog.Description>
            )}
          </div>
          <RadixDialog.Close
            aria-label={es.app.close}
            className="border-soft inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-surface text-ink hover:bg-accent"
          >
            <X size={20} strokeWidth={3} />
          </RadixDialog.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  </RadixDialog.Root>
)
