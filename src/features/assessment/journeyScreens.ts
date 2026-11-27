// The screens that appear once per student and journey step (the congratulations after a pass,
// the "review again" after three failures), remembered so they do not come back on every visit.
export type JourneyScreen = 'congrats_checkin' | 'congrats_final' | 'exhausted'

const key = (mapId: string, screen: JourneyScreen) => `rumbos:journey:${mapId}:${screen}`

export const wasScreenSeen = (storage: Storage | null, mapId: string, screen: JourneyScreen) => {
  try {
    return storage?.getItem(key(mapId, screen)) === '1'
  } catch {
    return false
  }
}

export const markScreenSeen = (storage: Storage | null, mapId: string, screen: JourneyScreen) => {
  try {
    storage?.setItem(key(mapId, screen), '1')
  } catch {
    // Nothing is remembered: the screen may show again, which is harmless.
  }
}
