import { useSyncExternalStore } from 'react'
import {
  createDataSaverStore,
  isDataSaverSetting,
  type ConnectionLike,
  type DataSaverSetting,
} from './dataSaver.ts'

const STORAGE_KEY = 'rumbos.dataSaver'

const connection = (): ConnectionLike | null =>
  typeof navigator === 'undefined'
    ? null
    : ((navigator as Navigator & { connection?: ConnectionLike }).connection ?? null)

// localStorage is a per-viewer convenience: it can be empty, blocked or throw.
export const dataSaverStore = createDataSaverStore({
  connection: connection(),
  readStored: () => {
    try {
      const value = window.localStorage.getItem(STORAGE_KEY)
      return isDataSaverSetting(value) ? value : null
    } catch {
      return null
    }
  },
  writeStored: (value: DataSaverSetting) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, value)
    } catch {
      // Not remembered; nothing else depends on it.
    }
  },
})

export const isDataSaverActive = () => dataSaverStore.isActive()

export const useDataSaver = () => {
  const active = useSyncExternalStore(dataSaverStore.subscribe, dataSaverStore.isActive)
  const setting = useSyncExternalStore(dataSaverStore.subscribe, dataSaverStore.getSetting)
  const detected = useSyncExternalStore(dataSaverStore.subscribe, dataSaverStore.isDetected)
  return { active, setting, detected, setSetting: dataSaverStore.setSetting }
}
