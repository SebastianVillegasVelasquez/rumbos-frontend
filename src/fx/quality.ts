import { useEffect, useReducer } from "react";
import { QUALITY_AUTO_FRAME_BUDGET_MS, QUALITY_AUTO_SAMPLE_MS } from "./constants.ts";

export type QualityTier = "high" | "medium" | "low" | "off";
export type QualitySetting = "auto" | QualityTier;

const STORAGE_KEY = "rumbos:animation-quality";
const TIERS: QualityTier[] = ["high", "medium", "low", "off"];
const SETTINGS: QualitySetting[] = ["auto", ...TIERS];

const prefersReducedMotion = () =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Single source of truth for animation quality across the whole fx engine:
// a user setting (persisted per-viewer in localStorage) plus an "auto" mode
// that samples real frame time for a few seconds and degrades once if it's
// too slow. Never upgrades mid-session, and prefers-reduced-motion always
// wins. Everything in fx/ and the viewport controller reads this instead of
// each maintaining its own notion of "should I animate".
class QualityStore {
    private setting: QualitySetting = "auto";
    private autoTier: QualityTier = "high";
    private sampleFrames = 0;
    private sampleTotalMs = 0;
    private sampled = false;
    private listeners = new Set<() => void>();

    constructor() {
        if (typeof window === "undefined") return;
        try {
            const stored = window.localStorage.getItem(STORAGE_KEY);
            if (stored && (SETTINGS as string[]).includes(stored)) this.setting = stored as QualitySetting;
        } catch {
            // Storage unavailable (private mode, blocked, etc) - fall back to "auto".
        }
    }

    getTier(): QualityTier {
        if (prefersReducedMotion()) return "off";
        return this.setting === "auto" ? this.autoTier : this.setting;
    }

    getSetting(): QualitySetting {
        return this.setting;
    }

    setSetting(setting: QualitySetting): void {
        this.setting = setting;
        try {
            window.localStorage.setItem(STORAGE_KEY, setting);
        } catch {
            // Per-viewer convenience only; fine to lose on failure.
        }
        this.emit();
    }

    // Fed frame-by-frame (timeDiff in ms) by the shared ticker while in
    // "auto" mode; samples the first QUALITY_AUTO_SAMPLE_MS of frames and
    // downgrades one tier if the average frame took too long. Runs once per
    // session - it never re-samples or upgrades afterwards.
    sampleFrame(timeDiffMs: number): void {
        if (this.setting !== "auto" || this.sampled || prefersReducedMotion()) return;
        this.sampleFrames++;
        this.sampleTotalMs += timeDiffMs;
        if (this.sampleTotalMs < QUALITY_AUTO_SAMPLE_MS) return;
        this.sampled = true;
        const avgFrameMs = this.sampleTotalMs / this.sampleFrames;
        if (avgFrameMs > QUALITY_AUTO_FRAME_BUDGET_MS) {
            const index = TIERS.indexOf(this.autoTier);
            this.autoTier = TIERS[Math.min(index + 1, TIERS.length - 1)];
            this.emit();
        }
    }

    subscribe(callback: () => void): () => void {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    private emit(): void {
        this.listeners.forEach((callback) => callback());
    }
}

export const qualityStore = new QualityStore();

export function useAnimationQuality() {
    const [, forceUpdate] = useReducer((n: number) => n + 1, 0);
    useEffect(() => qualityStore.subscribe(forceUpdate), []);
    return {
        tier: qualityStore.getTier(),
        setting: qualityStore.getSetting(),
        setSetting: (setting: QualitySetting) => qualityStore.setSetting(setting),
    };
}
