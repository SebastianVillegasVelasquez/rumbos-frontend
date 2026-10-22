// Data saver: for students on limited mobile data. It turns on by itself when
// the browser says the person asked for less data (Save-Data) or the connection
// is slow, and can be forced on or off by hand. This file is the logic with no
// browser dependency; dataSaverStore.ts wires it to navigator and localStorage.

export type DataSaverSetting = 'auto' | 'on' | 'off'

export interface ConnectionLike {
  saveData?: boolean
  effectiveType?: string
  addEventListener?: (type: 'change', listener: () => void) => void
  removeEventListener?: (type: 'change', listener: () => void) => void
}

const SLOW_TYPES: readonly string[] = ['slow-2g', '2g']

// Save-Data requested, or a slow effective connection type. An unknown
// connection (Safari reports none) is not slow.
export const isSlowConnection = (connection: ConnectionLike | null | undefined): boolean =>
  connection?.saveData === true ||
  (typeof connection?.effectiveType === 'string' && SLOW_TYPES.includes(connection.effectiveType))

export const isDataSaverSetting = (value: unknown): value is DataSaverSetting =>
  value === 'auto' || value === 'on' || value === 'off'

export interface DataSaverDeps {
  connection: ConnectionLike | null | undefined
  readStored: () => string | null
  writeStored: (value: DataSaverSetting) => void
}

export interface DataSaverStore {
  // What the data saver is doing now.
  isActive: () => boolean
  getSetting: () => DataSaverSetting
  // Whether the connection itself asks for it (regardless of the setting).
  isDetected: () => boolean
  setSetting: (setting: DataSaverSetting) => void
  subscribe: (listener: () => void) => () => void
}

export const createDataSaverStore = (deps: DataSaverDeps): DataSaverStore => {
  const stored = deps.readStored()
  let setting: DataSaverSetting = isDataSaverSetting(stored) ? stored : 'auto'
  let detected = isSlowConnection(deps.connection)
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((listener) => listener())

  const isActive = () => (setting === 'auto' ? detected : setting === 'on')

  // The connection can change while the app is open (a train, a tunnel).
  deps.connection?.addEventListener?.('change', () => {
    const next = isSlowConnection(deps.connection)
    if (next === detected) return
    detected = next
    emit()
  })

  return {
    isActive,
    getSetting: () => setting,
    isDetected: () => detected,
    setSetting: (next) => {
      if (next === setting) return
      setting = next
      deps.writeStored(next)
      emit()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
  }
}
