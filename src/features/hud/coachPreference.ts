// First-run coach marks are shown once per viewer. A per-viewer convenience
// only: if storage is blocked the marks simply show again next time.

const KEY = 'rumbos.coach.done'

export const readCoachDone = (storage: Pick<Storage, 'getItem'> | null): boolean => {
  try {
    return storage?.getItem(KEY) === '1'
  } catch {
    // Unknown: do not nag, the marks are a courtesy.
    return true
  }
}

export const rememberCoachDone = (storage: Pick<Storage, 'setItem'> | null) => {
  try {
    storage?.setItem(KEY, '1')
  } catch {
    // Not remembered; nothing else depends on it.
  }
}

export const COACH_STEPS = ['move', 'bubble', 'quests'] as const
export type CoachStep = (typeof COACH_STEPS)[number]
