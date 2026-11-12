import { useCallback, useEffect, useMemo, useState } from 'react'
import type { WelcomeShow, WelcomeStep } from '../../course-map/data/types.ts'
import type { EmbedContextValue } from '../../embed/EmbedContext.ts'
import { getHostFlowProgress, subscribeHostFlow } from '../../embed/hostFlow.ts'
import { viewerStorage } from '../../quests/viewerStorage.ts'
import { markWelcomeHandled, wasWelcomeHandled } from '../welcome.ts'
import {
  browserLocalStore,
  createFlowPersistence,
  type FlowPersistence,
} from './flowPersistence.ts'
import { isComplete, toStepInfo, type FlowMode, type ProgressEntry } from './flowReducer.ts'

// The decision to open the welcome flow, kept small because it lives in the
// initial bundle: the player itself is a lazy chunk. It asks where the progress
// lives (the host, else the local flag), decides between "show", "review" and
// "nothing", and hands the player what it needs. Nothing here goes to the backend.

export type FlowGateState =
  | { status: 'off' }
  // Waiting for the host (up to 3 s): the stage is covered so the map does not
  // flash before the flow.
  | { status: 'checking' }
  | {
      status: 'run'
      mode: FlowMode
      entries: ProgressEntry[]
      persistence: FlowPersistence | null
    }
  | { status: 'closed' }

interface FlowGateInput {
  mapId: string | null
  // The configured steps; null: no flow (the legacy curtain, or nothing).
  steps: WelcomeStep[] | null
  hash: string
  show: WelcomeShow
  // Enabled in the settings, not the editor mode, content to show.
  allowed: boolean
  isPreview: boolean
  embed: EmbedContextValue | null
}

const timers = (run: () => void, delayMs: number) => {
  const id = window.setTimeout(run, delayMs)
  return () => window.clearTimeout(id)
}

export interface FlowGate {
  state: FlowGateState
  // The viewer went through the flow (or closed a review or preview), with what
  // is done by then, so a "Ver bienvenida" afterwards knows it is complete.
  finish: (done?: readonly ProgressEntry[]) => void
  // "Ver bienvenida": always available. A completed flow opens in review mode.
  reopen: (() => void) | null
}

interface Loaded {
  key: string
  entries: ProgressEntry[]
  persistence: FlowPersistence
}

export const useFlowGate = ({
  mapId,
  steps,
  hash,
  show,
  allowed,
  isPreview,
  embed,
}: FlowGateInput): FlowGate => {
  const active = allowed && steps !== null && mapId !== null
  const key = `${mapId}:${hash}:${show}:${isPreview}`
  const infos = useMemo(() => (steps ?? []).map(toStepInfo), [steps])
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [closedKey, setClosedKey] = useState<string | null>(null)
  const [reopened, setReopened] = useState<{ key: string; mode: FlowMode } | null>(null)
  // What is done in this session, kept for the review decision.
  const [doneEntries, setDoneEntries] = useState<{ key: string; entries: ProgressEntry[] } | null>(
    null
  )
  const handled = mapId !== null && wasWelcomeHandled(mapId, hash)
  // The host calls only change when the session does.
  const requestProgress = embed?.requestFlowProgress
  const reportDone = embed?.reportFlowStepDone
  const hasHost = embed !== null

  // Ask where the progress lives. A preview asks nothing and writes nothing.
  useEffect(() => {
    if (!active || mapId === null || isPreview) return
    let cancelled = false
    const persistence = createFlowPersistence({
      mapId,
      steps: infos,
      requestProgress: () => requestProgress?.(mapId),
      reportDone: (completion) =>
        reportDone?.(mapId, completion.stepKey, completion.revision, completion.method),
      hostProgress: () => getHostFlowProgress(mapId),
      subscribeHost: subscribeHostFlow,
      store: browserLocalStore(viewerStorage),
      hasHost,
      now: () => Date.now(),
      schedule: timers,
    })
    void persistence.load().then((result) => {
      if (!cancelled) setLoaded({ key, entries: result.entries, persistence })
    })
    return () => {
      cancelled = true
      persistence.dispose()
    }
    // The persistence stays alive until the map changes, after the flow closes, to
    // finish its queued writes and to serve a later "Ver bienvenida".
  }, [active, mapId, key, isPreview, infos, requestProgress, reportDone, hasHost])

  const current = loaded?.key === key ? loaded : null
  const entries = doneEntries?.key === key ? doneEntries.entries : (current?.entries ?? [])

  const state = ((): FlowGateState => {
    if (!active) return { status: 'off' }
    if (reopened?.key === key)
      return {
        status: 'run',
        mode: reopened.mode,
        entries,
        persistence: current?.persistence ?? null,
      }
    if (closedKey === key) return { status: 'closed' }
    if (isPreview) return { status: 'run', mode: 'preview', entries: [], persistence: null }
    if (handled) return { status: 'closed' }
    if (!current) return { status: 'checking' }
    const complete = isComplete(infos, current.entries)
    if (complete && show === 'first_visit') return { status: 'closed' }
    return {
      status: 'run',
      mode: complete ? 'review' : 'normal',
      entries: current.entries,
      persistence: current.persistence,
    }
  })()

  const finish = useCallback(
    (done?: readonly ProgressEntry[]) => {
      if (mapId !== null && !isPreview) markWelcomeHandled(mapId, hash)
      if (done) setDoneEntries({ key, entries: [...done] })
      setReopened(null)
      setClosedKey(key)
    },
    [mapId, hash, isPreview, key]
  )

  const reopen = useCallback(() => {
    const known =
      doneEntries?.key === key ? doneEntries.entries : loaded?.key === key ? loaded.entries : []
    const complete = !isPreview && isComplete(infos, known)
    setReopened({ key, mode: complete ? 'review' : isPreview ? 'preview' : 'normal' })
  }, [doneEntries, loaded, key, isPreview, infos])

  return { state, finish, reopen: active ? reopen : null }
}
