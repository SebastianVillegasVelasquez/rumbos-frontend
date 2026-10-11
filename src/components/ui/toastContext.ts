import { createContext, useContext } from "react";

export interface ToastItem {
    id: number;
    message: string;
    tone: "info" | "error" | "success";
    action?: ToastOptions["action"];
}

export interface ToastOptions {
    // A single follow-up button, e.g. "Deshacer".
    action?: { label: string; onClick: () => void };
    durationMs?: number;
}

export interface ToastContextValue {
    show: (message: string, tone?: ToastItem["tone"], options?: ToastOptions) => number;
    dismiss: (id: number) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) throw new Error("useToast must be used within a ToastProvider");
    return context;
};
