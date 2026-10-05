import type { Activity } from "./data/types.ts";

export type ActivityOpenMode = "tab" | "modal";

export type ActivityOpener = (activity: Activity) => void;

export const ACTIVITY_OPEN_MODE: ActivityOpenMode =
    import.meta.env.VITE_ACTIVITY_OPEN_MODE === "modal" ? "modal" : "tab";

// Only web URLs may reach window.open or an iframe src. Anything else (for
// example a javascript: URL) is refused.
export const isSafeActivityUrl = (rawUrl: string) => {
    try {
        const { protocol } = new URL(rawUrl);
        return protocol === "http:" || protocol === "https:";
    } catch {
        return false;
    }
};

// Framing Moodle from another origin can be blocked by X-Frame-Options or CSP
// frame-ancestors, or by third-party cookie rules that show Moodle's login
// page inside the iframe. That's why "tab" is the default until the modal is
// verified against the real Moodle.
export const createActivityOpener = (mode: ActivityOpenMode, openModal: ActivityOpener): ActivityOpener => {
    if (mode === "modal") return openModal;
    return (activity) => {
        if (!isSafeActivityUrl(activity.url)) return;
        window.open(activity.url, "_blank", "noopener,noreferrer");
    };
};
