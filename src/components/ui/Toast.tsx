import { useCallback, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { ToastContext, type ToastItem, type ToastOptions } from "./toastContext.ts";

let nextId = 1;

export const ToastProvider = ({ children }: { children: ReactNode }) => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const dismiss = useCallback((id: number) => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
    }, []);

    const show = useCallback(
        (message: string, tone: ToastItem["tone"] = "info", options: ToastOptions = {}) => {
            const id = nextId++;
            setToasts((current) => [...current, { id, message, tone, action: options.action }]);
            setTimeout(() => dismiss(id), options.durationMs ?? 5000);
            return id;
        },
        [dismiss]
    );

    const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div className="fixed bottom-4 left-1/2 z-[60] flex w-[min(92vw,24rem)] -translate-x-1/2 flex-col gap-2">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        role="status"
                        className={`flex items-center gap-2 rounded-md px-4 py-3 text-sm font-medium shadow-soft ${
                            toast.tone === "error"
                                ? "bg-coral-tint text-coral-dark"
                                : toast.tone === "success"
                                  ? "bg-leaf-tint text-leaf-dark"
                                  : "bg-ink text-white"
                        }`}
                    >
                        {toast.tone === "error" && <AlertTriangle size={16} />}
                        {toast.tone === "success" && <CheckCircle2 size={16} />}
                        <span className="flex-1">{toast.message}</span>
                        {toast.action && (
                            <button
                                type="button"
                                onClick={() => {
                                    toast.action?.onClick();
                                    dismiss(toast.id);
                                }}
                                className="rounded-md px-2 py-1 text-xs font-bold uppercase tracking-wide underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
                            >
                                {toast.action.label}
                            </button>
                        )}
                        <button
                            type="button"
                            aria-label="Cerrar"
                            onClick={() => dismiss(toast.id)}
                            className="rounded-pill p-1 hover:bg-black/5"
                        >
                            <X size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

