// Whether the quest log was left open. A per-viewer convenience only (it can be
// empty, blocked or throw), and kept for the side panel alone: a bottom sheet
// that reopened by itself would cover half the map on every visit.

const KEY = 'rumbos.quests.open'

export const readQuestsOpen = (storage: Pick<Storage, 'getItem'> | null): boolean => {
  try {
    return storage?.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export const rememberQuestsOpen = (open: boolean, storage: Pick<Storage, 'setItem'> | null) => {
  try {
    storage?.setItem(KEY, open ? '1' : '0')
  } catch {
    // Not remembered; nothing else depends on it.
  }
}
