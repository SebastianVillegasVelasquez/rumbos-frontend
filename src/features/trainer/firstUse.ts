import { viewerStorage } from '../quests/viewerStorage.ts'

const ACCEPTED_KEY = 'rumbos.trainer.accepted.v1'

// S1 is shown once per user in this browser; the acceptance is remembered here (the
// server stores nothing about it). Storage can be missing: then it shows each time.
export const wasAccepted = (): boolean => {
  try {
    return viewerStorage()?.getItem(ACCEPTED_KEY) === '1'
  } catch {
    return false
  }
}
export const rememberAccepted = () => {
  try {
    viewerStorage()?.setItem(ACCEPTED_KEY, '1')
  } catch {
    /* shown again next time; harmless */
  }
}
