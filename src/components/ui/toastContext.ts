import { createContext, useContext } from "react";

export interface ToastItem {
    id: number;
    message: string;
    tone: "info" | "error" | "success";
}

export interface ToastContextValue {
    show: (message: string, tone?: ToastItem["tone"]) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) throw new Error("useToast must be used within a ToastProvider");
    return context;
};
