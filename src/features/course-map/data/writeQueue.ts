// A FIFO queue of guarded draft writes for ONE map.
//
// Guarded writes carry the revision/version the client last saw (If-Match).
// With optimistic UI, two quick edits can leave the second one in flight with
// the version the first one is about to bump, and the user would conflict with
// themselves. The queue prevents that: writes run strictly one at a time, and a
// job reads the version it needs when it RUNS (not when it was enqueued), after
// the previous response has already updated the cache.
//
// This module is deliberately free of React, fetch and the query client so the
// ordering/collapsing/conflict rules can be unit-tested on their own.

export class WriteDiscardedError extends Error {
    constructor() {
        super("The write was discarded after a conflict");
        this.name = "WriteDiscardedError";
    }
}

export const isWriteDiscarded = (error: unknown) => error instanceof WriteDiscardedError;

export interface WriteJob<T = unknown> {
    // What the job edits: "map" or `bubble:<id>`. A conflict takes every queued
    // job with the same target along with it, since they were all based on the
    // same stale state.
    target: string;
    // A queued (not yet started) job with the same key is replaced by the
    // newest one: rapid drags of one bubble collapse into the last position.
    collapseKey?: string;
    run: () => Promise<T>;
}

interface Waiter {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
}

interface Entry {
    job: WriteJob;
    waiters: Waiter[];
}

export interface ConflictEvent {
    target: string;
    error: unknown;
    // Number of queued jobs dropped together with the one that failed.
    droppedCount: number;
    // Re-run the failed job and the dropped ones, in their original order. They
    // read fresh versions when they run, so refetch the draft first.
    retry: () => void;
    // Give up on them: their promises reject with WriteDiscardedError.
    discard: () => void;
}

export interface WriteQueueOptions {
    isConflict: (error: unknown) => boolean;
    // Return false when nobody can resolve the conflict; the failure is then
    // treated like any other error instead of stalling the queue forever.
    onConflict?: (event: ConflictEvent) => boolean;
    // Called when the queue drains. `wrote` is true if at least one job
    // succeeded since the previous drain.
    onIdle?: (wrote: boolean) => void;
    onFailure?: (error: unknown, job: WriteJob) => void;
}

export class WriteQueue {
    private readonly options: WriteQueueOptions;
    private pending: Entry[] = [];
    private running = false;
    private halted = false;
    private haltId = 0;
    private epochCounter = 0;
    private wroteSinceIdle = false;
    private idleWaiters: Array<() => void> = [];

    constructor(options: WriteQueueOptions) {
        this.options = options;
    }

    // Changes whenever a write is enqueued or settles. A read that started and
    // finished under the same epoch, with the queue idle, overlapped no write.
    epoch() {
        return this.epochCounter;
    }

    isBusy() {
        return this.running || this.halted || this.pending.length > 0;
    }

    pendingCount() {
        return this.pending.length + (this.running ? 1 : 0);
    }

    whenIdle(): Promise<void> {
        if (!this.isBusy()) return Promise.resolve();
        return new Promise((resolve) => this.idleWaiters.push(resolve));
    }

    enqueue<T>(job: WriteJob<T>): Promise<T> {
        this.epochCounter++;
        return new Promise<T>((resolve, reject) => {
            const waiter: Waiter = { resolve: resolve as (value: unknown) => void, reject };
            const existing = job.collapseKey
                ? this.pending.find((entry) => entry.job.collapseKey === job.collapseKey)
                : undefined;
            if (existing) {
                existing.job = job;
                existing.waiters.push(waiter);
            } else {
                this.pending.push({ job, waiters: [waiter] });
            }
            void this.pump();
        });
    }

    private settleIdle() {
        if (this.isBusy()) return;
        const wrote = this.wroteSinceIdle;
        this.wroteSinceIdle = false;
        const waiters = this.idleWaiters;
        this.idleWaiters = [];
        waiters.forEach((resolve) => resolve());
        this.options.onIdle?.(wrote);
    }

    private async pump() {
        if (this.running || this.halted) return;
        this.running = true;
        while (!this.halted) {
            const entry = this.pending.shift();
            if (!entry) break;
            try {
                const result = await entry.job.run();
                this.wroteSinceIdle = true;
                this.epochCounter++;
                entry.waiters.forEach((waiter) => waiter.resolve(result));
            } catch (error) {
                this.epochCounter++;
                if (this.options.isConflict(error) && this.halt(entry, error)) break;
                this.options.onFailure?.(error, entry.job);
                entry.waiters.forEach((waiter) => waiter.reject(error));
            }
        }
        this.running = false;
        this.settleIdle();
    }

    // Stops the queue on a version conflict and hands the decision to the
    // caller. Returns false when nobody is listening.
    private halt(failed: Entry, error: unknown): boolean {
        const target = failed.job.target;
        const dropped = this.pending.filter((entry) => entry.job.target === target);
        const haltId = ++this.haltId;
        this.halted = true;
        this.pending = this.pending.filter((entry) => !dropped.includes(entry));
        const handled = this.options.onConflict?.({
            target,
            error,
            droppedCount: dropped.length,
            retry: () => this.release(haltId, () => this.pending.unshift(failed, ...dropped)),
            discard: () =>
                this.release(haltId, () => {
                    for (const entry of [failed, ...dropped]) {
                        entry.waiters.forEach((waiter) => waiter.reject(new WriteDiscardedError()));
                    }
                }),
        });
        if (!handled) {
            this.halted = false;
            this.pending.unshift(...dropped);
        }
        return handled === true;
    }

    // Each halt can be released once; a stale event cannot release a later halt.
    private release(haltId: number, apply: () => void) {
        if (!this.halted || haltId !== this.haltId) return;
        this.halted = false;
        apply();
        this.epochCounter++;
        // Deferred so a handler that resolves synchronously inside onConflict
        // still lets the pump loop that raised it finish unwinding first.
        queueMicrotask(() => void this.pump());
    }
}
