import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WriteDiscardedError, WriteQueue, type ConflictEvent, type WriteJob } from "./writeQueue.ts";

class Conflict extends Error {}
const isConflict = (error: unknown) => error instanceof Conflict;

const deferred = <T = void>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((res) => {
        resolve = res;
    });
    return { promise, resolve };
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

// Models a server that guards writes with a version, like the real API.
const createServer = () => {
    let version = 1;
    const log: string[] = [];
    return {
        get version() {
            return version;
        },
        bumpElsewhere: () => version++,
        write: async (label: string, sent: number) => {
            await tick();
            if (sent !== version) throw new Conflict(`stale ${label}`);
            version++;
            log.push(label);
            return version;
        },
        log,
    };
};

const conflictRecorder = () => {
    const state: { event: ConflictEvent | null } = { event: null };
    return {
        state,
        onConflict: (event: ConflictEvent) => {
            state.event = event;
            return true;
        },
    };
};

describe("WriteQueue", () => {
    it("runs jobs strictly one at a time, in order", async () => {
        const queue = new WriteQueue({ isConflict });
        const order: string[] = [];
        let active = 0;
        let maxActive = 0;
        const job = (name: string): WriteJob => ({
            target: "map",
            run: async () => {
                active++;
                maxActive = Math.max(maxActive, active);
                await tick();
                order.push(name);
                active--;
            },
        });
        await Promise.all([queue.enqueue(job("a")), queue.enqueue(job("b")), queue.enqueue(job("c"))]);
        assert.deepEqual(order, ["a", "b", "c"]);
        assert.equal(maxActive, 1);
    });

    it("lets quick edits avoid conflicting with themselves because jobs read the version when they run", async () => {
        const server = createServer();
        const queue = new WriteQueue({ isConflict });
        let cachedVersion = server.version;
        const edit = (label: string): WriteJob => ({
            target: "bubble:1",
            run: async () => {
                cachedVersion = await server.write(label, cachedVersion);
            },
        });
        await Promise.all([queue.enqueue(edit("one")), queue.enqueue(edit("two")), queue.enqueue(edit("three"))]);
        assert.deepEqual(server.log, ["one", "two", "three"]);
    });

    it("collapses queued jobs with the same key into the latest one", async () => {
        const queue = new WriteQueue({ isConflict });
        const gate = deferred();
        const ran: string[] = [];
        const first = queue.enqueue({ target: "map", run: () => gate.promise.then(() => void ran.push("blocker")) });
        const drag = (position: string): WriteJob => ({
            target: "bubble:1",
            collapseKey: "pos:1",
            run: async () => void ran.push(position),
        });
        const results = [queue.enqueue(drag("p1")), queue.enqueue(drag("p2")), queue.enqueue(drag("p3"))];
        gate.resolve();
        await Promise.all([first, ...results]);
        assert.deepEqual(ran, ["blocker", "p3"]);
    });

    it("does not collapse into a job that is already running", async () => {
        const queue = new WriteQueue({ isConflict });
        const gate = deferred();
        const ran: string[] = [];
        const running = queue.enqueue({
            target: "bubble:1",
            collapseKey: "pos:1",
            run: () => gate.promise.then(() => void ran.push("running")),
        });
        await tick();
        const next = queue.enqueue({ target: "bubble:1", collapseKey: "pos:1", run: async () => void ran.push("next") });
        gate.resolve();
        await Promise.all([running, next]);
        assert.deepEqual(ran, ["running", "next"]);
    });

    it("keeps going after an ordinary failure and rejects only that job", async () => {
        const queue = new WriteQueue({ isConflict });
        const failing = queue.enqueue({
            target: "map",
            run: async () => {
                throw new Error("boom");
            },
        });
        const after = queue.enqueue({ target: "map", run: async () => "ok" });
        await assert.rejects(failing, /boom/);
        assert.equal(await after, "ok");
    });

    it("halts on a conflict, takes same-target jobs along, and lets other targets resume", async () => {
        const recorder = conflictRecorder();
        const queue = new WriteQueue({ isConflict, onConflict: recorder.onConflict });
        const ran: string[] = [];
        const conflicting = queue.enqueue({
            target: "bubble:1",
            run: async () => {
                throw new Conflict("stale");
            },
        });
        const sameTarget = queue.enqueue({ target: "bubble:1", collapseKey: "icon:1", run: async () => void ran.push("same") });
        const otherTarget = queue.enqueue({ target: "bubble:2", run: async () => void ran.push("other") });
        await tick();
        await tick();
        const event = recorder.state.event;
        assert.ok(event, "conflict reported");
        assert.equal(event.droppedCount, 1);
        assert.deepEqual(ran, [], "nothing runs while halted");

        event.discard();
        await assert.rejects(conflicting, WriteDiscardedError);
        await assert.rejects(sameTarget, WriteDiscardedError);
        await otherTarget;
        assert.deepEqual(ran, ["other"]);
    });

    it("re-sends the failed job and the dropped ones on retry, in order", async () => {
        const server = createServer();
        let cachedVersion = server.version;
        const recorder = conflictRecorder();
        const queue = new WriteQueue({ isConflict, onConflict: recorder.onConflict });
        const edit = (label: string): WriteJob => ({
            target: "map",
            run: async () => {
                cachedVersion = await server.write(label, cachedVersion);
            },
        });
        server.bumpElsewhere();
        const first = queue.enqueue(edit("title"));
        const second = queue.enqueue(edit("appearance"));
        await tick();
        await tick();
        const event = recorder.state.event;
        assert.ok(event, "conflict reported");
        cachedVersion = server.version; // the "refetch"
        event.retry();
        await Promise.all([first, second]);
        assert.deepEqual(server.log, ["title", "appearance"]);
    });

    it("treats a conflict as a plain failure when nobody handles it", async () => {
        const queue = new WriteQueue({ isConflict, onConflict: () => false });
        const failing = queue.enqueue({
            target: "map",
            run: async () => {
                throw new Conflict("stale");
            },
        });
        const after = queue.enqueue({ target: "map", run: async () => "ok" });
        await assert.rejects(failing, Conflict);
        assert.equal(await after, "ok");
    });

    it("ignores a stale conflict event once it was already resolved", async () => {
        const recorder = conflictRecorder();
        const queue = new WriteQueue({ isConflict, onConflict: recorder.onConflict });
        const failing = queue.enqueue({
            target: "map",
            run: async () => {
                throw new Conflict("stale");
            },
        });
        await tick();
        const event = recorder.state.event;
        assert.ok(event, "conflict reported");
        event.discard();
        await assert.rejects(failing, WriteDiscardedError);
        event.retry();
        assert.equal(queue.isBusy(), false);
    });

    it("reports idle once, with whether anything was written", async () => {
        const idle: boolean[] = [];
        const queue = new WriteQueue({ isConflict, onIdle: (wrote) => idle.push(wrote) });
        await Promise.all([queue.enqueue({ target: "map", run: async () => 1 }), queue.enqueue({ target: "map", run: async () => 2 })]);
        await queue.whenIdle();
        assert.deepEqual(idle, [true]);
    });

    it("changes epoch around writes so overlapping reads can be detected", async () => {
        const queue = new WriteQueue({ isConflict });
        const before = queue.epoch();
        await queue.enqueue({ target: "map", run: async () => undefined });
        assert.notEqual(queue.epoch(), before);
    });
});
