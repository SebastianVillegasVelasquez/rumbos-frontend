import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { ToastContext, type ToastItem, type ToastOptions } from './toastContext.ts'

let nextId = 1

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const show = useCallback(
    (message: string, tone: ToastItem['tone'] = 'info', options: ToastOptions = {}) => {
      const id = nextId++
      setToasts((current) => [...current, { id, message, tone, action: options.action }])
      setTimeout(() => dismiss(id), options.durationMs ?? 5000)
      return id
    },
    [dismiss]
  )

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-[min(calc(100vw-2rem),24rem)] -translate-x-1/2 flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-center gap-2 border-soft rounded-md px-4 py-3 text-sm font-semibold shadow-sm ${
              toast.tone === 'error'
                ? 'bg-danger-tint text-danger'
                : toast.tone === 'success'
                  ? 'bg-leaf-tint text-leaf-dark'
                  : 'bg-ink text-white'
            }`}
          >
            {toast.tone === 'error' && <AlertTriangle size={18} strokeWidth={2.5} />}
            {toast.tone === 'success' && <CheckCircle2 size={18} strokeWidth={2.5} />}
            <span className="min-w-0 flex-1 break-words">{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onClick()
                  dismiss(toast.id)
                }}
                className="min-h-[44px] rounded-md px-2 text-xs font-bold uppercase tracking-wide underline underline-offset-2"
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => dismiss(toast.id)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-ink/10"
            >
              <X size={16} strokeWidth={3} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
