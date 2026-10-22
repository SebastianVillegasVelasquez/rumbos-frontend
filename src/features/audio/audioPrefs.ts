// What the viewer chose about the music: whether they switched it off, and the
// volume they like. Per viewer, in localStorage, which can be empty, blocked or
// hold anything, so every read is validated.

export interface AudioPrefs {
  // The viewer switched the music off themselves (it is not autostarted again).
  muted: boolean
  // 0..1; null means they never touched the slider (the map's volume applies).
  volume: number | null
}

export const DEFAULT_PREFS: AudioPrefs = { muted: false, volume: null }

const KEY = 'rumbos.audio.prefs'

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

export const readAudioPrefs = (storage: Pick<Storage, 'getItem'> | null): AudioPrefs => {
  try {
    const raw = storage?.getItem(KEY)
    if (!raw) return DEFAULT_PREFS
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_PREFS
    const { muted, volume } = parsed as Record<string, unknown>
    return {
      muted: muted === true,
      volume: typeof volume === 'number' && Number.isFinite(volume) ? clamp01(volume) : null,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

export const rememberAudioPrefs = (prefs: AudioPrefs, storage: Pick<Storage, 'setItem'> | null) => {
  try {
    storage?.setItem(KEY, JSON.stringify(prefs))
  } catch {
    // Not remembered; nothing else depends on it.
  }
}

// The volume to play at: the viewer's own, else the map's.
export const effectiveVolume = (prefs: AudioPrefs, mapVolume: number): number =>
  clamp01(prefs.volume ?? mapVolume)

// May the music begin by itself after the first gesture?
export const mayAutostart = (input: {
  startAfterInteraction: boolean
  prefs: AudioPrefs
  dataSaver: boolean
}): boolean => input.startAfterInteraction && !input.prefs.muted && !input.dataSaver
