import Konva from "konva";

export interface TickFrame {
    time: number;
    timeDiff: number;
    frameRate: number;
}

type TickCallback = (frame: TickFrame) => void;

// One Konva.Animation per Stage, shared by every subscriber (the viewport's
// pan/zoom smoothing now, the fx/ engine's idle/transition/ambient loops
// later). There must never be a second RAF-driven loop competing with this
// one - that duplication is exactly what made the old wheel/zoom code fight
// itself. Call Konva.Animation's own start/stop from the last/first
// subscriber so the browser does no work when nothing is animating.
class SharedTicker {
    private callbacks = new Set<TickCallback>();
    private anim: Konva.Animation | null = null;

    private ensureAnim(stage: Konva.Stage) {
        if (this.anim) return;
        this.anim = new Konva.Animation((frame) => {
            if (!frame) return;
            for (const callback of this.callbacks) callback(frame);
        }, stage);
    }

    subscribe(stage: Konva.Stage, callback: TickCallback): () => void {
        this.ensureAnim(stage);
        this.callbacks.add(callback);
        if (!this.anim!.isRunning()) this.anim!.start();
        return () => {
            this.callbacks.delete(callback);
            if (this.callbacks.size === 0) this.anim?.stop();
        };
    }
}

export const sharedTicker = new SharedTicker();
