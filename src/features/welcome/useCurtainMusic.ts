import { useEffect, useState, useSyncExternalStore } from 'react'
import { isDataSaverActive } from '../../fx/dataSaverStore.ts'
import { readAudioPrefs } from '../audio/audioPrefs.ts'
import { viewerStorage } from '../quests/viewerStorage.ts'
import { createCurtainMusic, type CurtainMusic, type CurtainSession } from './curtainMusic.ts'

const loadSession = async (): Promise<CurtainSession> =>
  (await import('../audio/audioSession.ts')).audioSession

// The audio session loads while the viewer reads, so the button can start the
// music in the same call stack (iOS Safari only allows that). `enabled` is off
// when there is no music or the curtain is the editor's own look at itself.
export const useCurtainMusic = ({
  enabled,
  startAfterInteraction,
}: {
  enabled: boolean
  startAfterInteraction: boolean
}): { on: boolean } & Pick<CurtainMusic, 'toggle' | 'begin' | 'hold'> => {
  const [music] = useState(() =>
    createCurtainMusic({
      loadSession,
      readPrefs: () => readAudioPrefs(viewerStorage()),
      startAfterInteraction,
      dataSaver: isDataSaverActive,
    })
  )
  useEffect(() => {
    if (!enabled) return
    music.start()
    return () => music.dispose()
  }, [enabled, music])
  const on = useSyncExternalStore(music.subscribe, music.getSnapshot)
  return { on, toggle: music.toggle, begin: music.begin, hold: music.hold }
}
