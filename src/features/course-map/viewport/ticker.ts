import Konva from "konva";
import { qualityStore } from "../../../fx/quality.ts";

export interface TickFrame {
    time: number;
    timeDiff: number;
    frameRate: number;
}

type TickCallback = (frame: TickFrame) => void;

// One Konva.Animation per Stage, shared by every subscriber (the viewport's
// pan/zoom smoothing, and the fx/ engine's idle/transition/path/ambient
// loops). There must never be a second RAF-driven loop competing with this
// one - that duplication is exactly what made the old wheel/zoom code fight
// itself. Call Konva.Animation's own start/stop from the last/first
// subscriber so the browser does no work when nothing is animating, and
// pause outright when the tab is hidden.
class SharedTicker {
    private callbacks = new Set<TickCallback>();
    private anim: Konva.Animation | null = null;
    private hidden = typeof document !== "undefined" && document.hidden;

    private ensureAnim(stage: Konva.Stage) {
        if (this.anim) return;
        this.anim = new Konva.Animation((frame) => {
            if (!frame) return;
            qualityStore.sampleFrame(frame.timeDiff);
            for (const callback of this.callbacks) callback(frame);
        }, stage);

        if (typeof document !== "undefined") {
            document.addEventListener("visibilitychange", () => {
                this.hidden = document.hidden;
                if (this.hidden) this.anim?.stop();
                else if (this.callbacks.size > 0) this.anim?.start();
            });
        }
    }

    subscribe(stage: Konva.Stage, callback: TickCallback): () => void {
        this.ensureAnim(stage);
        this.callbacks.add(callback);
        if (!this.hidden && !this.anim!.isRunning()) this.anim!.start();
        return () => {
            this.callbacks.delete(callback);
            if (this.callbacks.size === 0) this.anim?.stop();
        };
    }
}

export const sharedTicker = new SharedTicker();
