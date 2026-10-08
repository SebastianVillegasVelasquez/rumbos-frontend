// Every effect's tunable parameters in one place, per quality tier where it
// matters. Nothing here is logic - see idle.ts/transitions.ts/completion.ts/
// path.ts/camera.ts/ambient.ts for how these are used.

export const IDLE = {
    float: { amplitude: 6, periodMs: 2400 },
    pulse: { amplitude: 0.05, periodMs: 1300 },
    breathe: { amplitude: 0.035, periodMs: 1300 },
};

export const TRANSITIONS = {
    unlockPopDurationS: 0.22,
    unlockPopScale: 1.22,
    rippleDurationS: 0.5,
    rippleScale: 1.8,
    burstParticleCount: 24,
    burstDurationS: 0.6,
};

export const COMPLETION = {
    celebration: { high: 60, medium: 30, low: 0, off: 0 },
    bannerDurationMs: 2200,
};

export const PATH = {
    dashLength: 16,
    gapLength: 10,
    flowSpeedPxPerMs: 1 / 35,
    travelerPeriodMs: 3000,
};

export const CAMERA = {
    flyToDurationMs: 420,
};

export const AMBIENT = {
    baseCountByKind: {
        none: 0,
        fireflies: 18,
        snow: 40,
        leaves: 14,
        clouds: 6,
        sparkles: 24,
    },
    capByTier: { high: 80, medium: 30, low: 0, off: 0 },
};

export const QUALITY_AUTO_SAMPLE_MS = 3000;
export const QUALITY_AUTO_FRAME_BUDGET_MS = 24;
