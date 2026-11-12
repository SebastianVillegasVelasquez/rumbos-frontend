import type { FlowMethod } from '../../embed/protocol.ts'
import type { HostFlowProgress } from '../../embed/hostFlow.ts'
import type { NewCompletion, ProgressEntry } from './flowReducer.ts'

// Where the progress of the welcome flow lives. It is the host (Moodle) and
// nowhere else: nothing in this module talks to the backend, and nothing is
// logged. When the host does not answer, a flag local to the viewer (localStorage
// in try/catch, memory only if that fails) keeps the flow from repeating.
// Dependencies are injected so the rules can be tested without a browser.

// How long the host has to answer request-flow-progress.
export const PROGRESS_TIMEOUT_MS = 3_000

export type ProgressSource =
  // Moodle keeps it.
  | 'host'
  // The host answered that it does not keep it (a guest, a preview): memory only.
  | 'memory'
  // The host is silent or cannot record (older plugin, readonly, unavailable): the
  // viewer-local flag.
  | 'local'

export interface LoadedProgress {
  source: ProgressSource
  entries: ProgressEntry[]
  // Settings the host sent; null when there was no answer.
  quizThreshold: number | null
}

// ---- The local flag -------------------------------------------------------------

export interface LocalStore {
  get: (key: string) => string | null
  set: (key: string, value: string) => void
}

const memory = new Map<string, string>()
const METHODS: readonly string[] = ['completed', 'fallback', 'unavailable']

// Per map, step key and revision: a raised revision is a different flag, so
// "ask again" works without the host too.
export const localFlagKey = (mapId: string, stepKey: string, revision: number) =>
  `rumbos.welcome.flow.${mapId}.${stepKey}.${revision}`

// localStorage inside try/catch; the memory fallback when it throws (a private
// window, blocked site data) or does not exist.
export const browserLocalStore = (storage: () => Storage | null): LocalStore => ({
  get: (key) => {
    try {
      const value = storage()?.getItem(key) ?? null
      return value ?? memory.get(key) ?? null
    } catch {
      return memory.get(key) ?? null
    }
  },
  set: (key, value) => {
    memory.set(key, value)
    try {
      storage()?.setItem(key, value)
    } catch {
      // Memory only.
    }
  },
})

export const readLocalFlags = (
  store: LocalStore,
  mapId: string,
  steps: readonly { key: string; revision: number }[]
): ProgressEntry[] => {
  const entries: ProgressEntry[] = []
  for (const step of steps) {
    const value = store.get(localFlagKey(mapId, step.key, step.revision))
    if (value !== null && METHODS.includes(value))
      entries.push({ stepKey: step.key, revision: step.revision, method: value as FlowMethod })
  }
  return entries
}

export const writeLocalFlag = (store: LocalStore, mapId: string, completion: NewCompletion) =>
  store.set(localFlagKey(mapId, completion.stepKey, completion.revision), completion.method)

// ---- The write queue --------------------------------------------------------------

// The plugin allows 30 writes a minute per user. The queue sends at once while it
// is under a sliding window of 28 a minute (a flow has 12 steps at most, so a
// viewer who clicks through quickly loses none), retries what the host has not
// confirmed with growing delays, and gives up after a few attempts: a failure
// never blocks the viewer, and it never loops.
export const MAX_WRITES_PER_MINUTE = 28
export const WRITE_WINDOW_MS = 60_000
export const RETRY_BASE_MS = 3_000
export const RETRY_MAX_MS = 60_000
export const MAX_ATTEMPTS = 6

export interface WriteQueueDeps {
  send: (completion: NewCompletion) => void
  // The host has recorded it (its progress lists the step at that revision).
  isConfirmed: (completion: NewCompletion) => boolean
  now: () => number
  schedule: (run: () => void, delayMs: number) => () => void
}

export interface WriteQueue {
  enqueue: (completion: NewCompletion) => void
  // The host answered: drop what it confirmed and send the next.
  onHostAnswer: () => void
  pending: () => number
  // Takes what is still unconfirmed out of the queue (the host stopped recording).
  drain: () => NewCompletion[]
  dispose: () => void
}

export const retryDelay = (attempts: number): number =>
  Math.min(RETRY_BASE_MS * 2 ** Math.max(0, attempts - 1), RETRY_MAX_MS)

export const createWriteQueue = (deps: WriteQueueDeps): WriteQueue => {
  interface Entry {
    completion: NewCompletion
    attempts: number
    // When this entry may be sent again.
    notBefore: number
  }
  let queue: Entry[] = []
  let sentAt: number[] = []
  let cancelTimer: (() => void) | null = null
  let disposed = false

  const sameStep = (a: NewCompletion, b: NewCompletion) =>
    a.stepKey === b.stepKey && a.revision === b.revision

  const settle = () => {
    queue = queue.filter((entry) => !deps.isConfirmed(entry.completion))
  }

  const pump = () => {
    cancelTimer?.()
    cancelTimer = null
    if (disposed) return
    settle()
    const now = deps.now()
    // After its last attempt an entry gets one more retry window to be confirmed.
    queue = queue.filter((entry) => entry.attempts < MAX_ATTEMPTS || entry.notBefore > now)
    if (queue.length === 0) return
    sentAt = sentAt.filter((at) => now - at < WRITE_WINDOW_MS)
    const ready = queue.find((entry) => entry.attempts < MAX_ATTEMPTS && entry.notBefore <= now)
    if (ready && sentAt.length < MAX_WRITES_PER_MINUTE) {
      ready.attempts += 1
      ready.notBefore = now + retryDelay(ready.attempts)
      sentAt.push(now)
      deps.send(ready.completion)
      // Back for the next entry, or to check this one is confirmed.
      cancelTimer = deps.schedule(pump, 0)
      return
    }
    // Nothing can go now: wait for the earliest entry, and for the window to
    // free a slot if it is full.
    const entryAt = Math.min(...queue.map((entry) => entry.notBefore))
    const slotAt = sentAt.length >= MAX_WRITES_PER_MINUTE ? sentAt[0] + WRITE_WINDOW_MS : 0
    cancelTimer = deps.schedule(
      pump,
      Math.max(entryAt, slotAt) - now > 0 ? Math.max(entryAt, slotAt) - now : 1
    )
  }

  return {
    enqueue: (completion) => {
      const existing = queue.find((entry) => sameStep(entry.completion, completion))
      if (existing) existing.completion = completion
      else queue.push({ completion, attempts: 0, notBefore: 0 })
      pump()
    },
    onHostAnswer: pump,
    pending: () => queue.length,
    drain: () => {
      const rest = queue.map((entry) => entry.completion)
      queue = []
      return rest
    },
    dispose: () => {
      disposed = true
      cancelTimer?.()
      cancelTimer = null
      queue = []
    },
  }
}

// ---- Loading and recording --------------------------------------------------------

export interface PersistenceDeps {
  mapId: string
  steps: readonly { key: string; revision: number }[]
  // What goes to the host: both are cheap and idempotent.
  requestProgress: () => void
  reportDone: (completion: NewCompletion) => void
  hostProgress: () => HostFlowProgress | null
  // Called whenever the host sends anything about the flow.
  subscribeHost: (listener: () => void) => () => void
  store: LocalStore
  // False in the standalone app: there is no host to ask, so the local flag is
  // used at once instead of waiting for a silence that cannot end otherwise.
  hasHost?: boolean
  now: () => number
  schedule: (run: () => void, delayMs: number) => () => void
}

export interface FlowPersistence {
  // Resolves with where the progress lives and what is already done: the host's
  // answer, or after PROGRESS_TIMEOUT_MS the local flag.
  load: () => Promise<LoadedProgress>
  // Report what the viewer completed. Never throws, never blocks.
  record: (completions: readonly NewCompletion[]) => void
  source: () => ProgressSource | null
  dispose: () => void
}

export const createFlowPersistence = (deps: PersistenceDeps): FlowPersistence => {
  let source: ProgressSource | null = null
  let queue: WriteQueue | null = null
  let unsubscribe: (() => void) | null = null
  let cancelTimeout: (() => void) | null = null
  let disposed = false

  const confirmed = (completion: NewCompletion): boolean => {
    const view = deps.hostProgress()
    return (
      view?.status === 'ready' &&
      view.items.some(
        (item) => item.stepKey === completion.stepKey && item.revision >= completion.revision
      )
    )
  }

  const toLocal = (): LoadedProgress => {
    source = 'local'
    queue?.dispose()
    queue = null
    return {
      source,
      entries: readLocalFlags(deps.store, deps.mapId, deps.steps),
      quizThreshold: null,
    }
  }

  return {
    load: () =>
      new Promise<LoadedProgress>((resolve) => {
        let settled = false
        const finish = (value: LoadedProgress) => {
          if (settled) return
          settled = true
          cancelTimeout?.()
          cancelTimeout = null
          resolve(value)
        }
        const check = () => {
          const view = deps.hostProgress()
          if (!view) return
          if (view.status === 'error') {
            // readonly or unavailable: Moodle cannot record. Same as silence.
            finish(toLocal())
            return
          }
          if (!view.persistent) {
            source = 'memory'
            finish({ source, entries: [], quizThreshold: view.quizThreshold })
            return
          }
          source = 'host'
          queue ??= createWriteQueue({
            send: deps.reportDone,
            isConfirmed: confirmed,
            now: deps.now,
            schedule: deps.schedule,
          })
          finish({
            source,
            entries: view.items.map(({ stepKey, revision, method }) => ({
              stepKey,
              revision,
              method,
            })),
            quizThreshold: view.quizThreshold,
          })
        }
        unsubscribe = deps.subscribeHost(() => {
          if (disposed) return
          if (!settled) check()
          else if (source === 'host') {
            // A later answer (to a write): confirm and send the next.
            if (deps.hostProgress()?.status === 'error') {
              // The host stopped recording: keep what was queued, locally.
              for (const completion of queue?.drain() ?? [])
                writeLocalFlag(deps.store, deps.mapId, completion)
              queue?.dispose()
              queue = null
              source = 'local'
            } else queue?.onHostAnswer()
          }
        })
        if (deps.hasHost === false) {
          finish(toLocal())
          return
        }
        // An answer may already be there (the flow reopened in the same session).
        deps.requestProgress()
        check()
        if (!settled) cancelTimeout = deps.schedule(() => finish(toLocal()), PROGRESS_TIMEOUT_MS)
      }),

    record: (completions) => {
      if (disposed) return
      for (const completion of completions) {
        if (source === 'host') queue?.enqueue(completion)
        else if (source === 'local') writeLocalFlag(deps.store, deps.mapId, completion)
        // 'memory': the host said it does not keep it; so do we.
      }
    },
    source: () => source,
    dispose: () => {
      disposed = true
      cancelTimeout?.()
      unsubscribe?.()
      queue?.dispose()
    },
  }
}
