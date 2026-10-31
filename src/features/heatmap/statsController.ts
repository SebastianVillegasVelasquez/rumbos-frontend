import { clearHostStats, markStatsRequested, markStatsSilent } from '../embed/hostStats.ts'

// Asks the host for completion counts and notices when it never answers (a
// plugin that predates contract v5.7 ignores the message). The numbers
// themselves land in the memory-only store in embed/hostStats.ts.

// Long enough for a slow Moodle query, short enough that an old plugin does not
// leave the toggle spinning.
export const SILENCE_MS = 8_000

export interface StatsControllerDeps {
  send: (groupId?: number) => void
  schedule: (run: () => void, delayMs: number) => () => void
}

export interface StatsController {
  request: (groupId?: number) => void
  refresh: () => void
  // The toggle went off or the app unloads: nothing stays behind.
  stop: () => void
}

export const createStatsController = (deps: StatsControllerDeps): StatsController => {
  let groupId: number | undefined
  let cancelSilence: (() => void) | null = null

  const request = (next?: number) => {
    groupId = next
    cancelSilence?.()
    markStatsRequested()
    cancelSilence = deps.schedule(markStatsSilent, SILENCE_MS)
    deps.send(groupId)
  }

  return {
    request,
    refresh: () => request(groupId),
    stop: () => {
      cancelSilence?.()
      cancelSilence = null
      groupId = undefined
      clearHostStats()
    },
  }
}
