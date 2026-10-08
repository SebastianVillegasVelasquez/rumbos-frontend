import { useCallback, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { ToastContext, type ToastItem } from "./toastContext.ts";

let nextId = 1;

export const ToastProvider = ({ children }: { children: ReactNode }) => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const dismiss = useCallback((id: number) => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
    }, []);

    const show = useCallback(
        (message: string, tone: ToastItem["tone"] = "info") => {
            const id = nextId++;
            setToasts((current) => [...current, { id, message, tone }]);
            setTimeout(() => dismiss(id), 5000);
        },
        [dismiss]
    );

    return (
        <ToastContext.Provider value={{ show }}>
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

