import { useCallback, useEffect, useMemo, useState } from 'react'
import type { WelcomeStep } from '../course-map/data/types.ts'
import type { EmbedContextValue } from '../embed/EmbedContext.ts'
import { getHostFlowProgress, subscribeHostFlow } from '../embed/hostFlow.ts'
import { viewerStorage } from '../quests/viewerStorage.ts'
import {
  browserLocalStore,
  createFlowPersistence,
  type FlowPersistence,
} from '../welcome/flow/flowPersistence.ts'
import { toStepInfo, type ProgressEntry } from '../welcome/flow/flowReducer.ts'
import { entriesAfterFinish } from './closingResume.ts'

// The closing flow's progress, kept where the welcome flow's is: in Moodle, by map and step key
// (contract v5.8; step keys are unique across both flows). The same persistence, with the same
// fallback to a viewer-local flag when the host is silent or cannot record.

export interface ClosingProgressView {
  // Null until Moodle (or the fallback) answers.
  entries: ProgressEntry[] | null
  persistence: FlowPersistence | null
  // The player closed: remember what is done without asking again.
  finish: (done: readonly ProgressEntry[]) => void
}

const timers = (run: () => void, delayMs: number) => {
  const id = window.setTimeout(run, delayMs)
  return () => window.clearTimeout(id)
}

interface Loaded {
  key: string
  entries: ProgressEntry[]
  persistence: FlowPersistence
}

export const useClosingProgress = ({
  mapId,
  steps,
  enabled,
  embed,
}: {
  mapId: string | null
  steps: WelcomeStep[]
  // A student's view of a level with a closing flow. An editor's preview asks and writes nothing.
  enabled: boolean
  embed: EmbedContextValue | null
}): ClosingProgressView => {
  const active = enabled && mapId !== null && steps.length > 0
  // The steps by what progress depends on: a fresh read of the same map keeps the persistence,
  // and with it the writes still queued.
  const signature = steps.map((step) => `${step.key}:${step.revision}`).join(',')
  const key = `${mapId}|${signature}`
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const infos = useMemo(() => steps.map(toStepInfo), [signature])
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [finished, setFinished] = useState<{ key: string; entries: ProgressEntry[] } | null>(null)
  const requestProgress = embed?.requestFlowProgress
  const reportDone = embed?.reportFlowStepDone
  const hasHost = embed !== null

  useEffect(() => {
    if (!active || mapId === null) return
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
  }, [active, mapId, key, infos, requestProgress, reportDone, hasHost])

  const current = active && loaded?.key === key ? loaded : null
  const entries = current ? (finished?.key === key ? finished.entries : current.entries) : null

  const finish = useCallback(
    (done: readonly ProgressEntry[]) =>
      setFinished((previous) => ({
        key,
        entries: entriesAfterFinish(
          steps,
          previous?.key === key ? previous.entries : loaded?.key === key ? loaded.entries : [],
          done
        ),
      })),
    [key, steps, loaded]
  )

  return { entries, persistence: current?.persistence ?? null, finish }
}
