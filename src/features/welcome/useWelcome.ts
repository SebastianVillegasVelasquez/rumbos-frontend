import { useCallback, useMemo, useState } from 'react'
import type { MapSettings, MapWelcome } from '../course-map/data/types.ts'
import { viewerStorage } from '../quests/viewerStorage.ts'
import {
  markWelcomeHandled,
  rememberWelcomeSeen,
  resolveWelcome,
  shouldShowWelcome,
  welcomeHash,
} from './welcome.ts'

interface UseWelcomeInput {
  // Null until a map is on screen.
  mapId: string | null
  settings: MapSettings['welcome']
  // The editor's own mode: the curtain is for what students see.
  isEditorMode: boolean
  // "Vista previa": shown, but nothing is remembered.
  isPreview: boolean
  // The app told the host there is nothing to show.
  noContent: boolean
}

export interface WelcomeState {
  welcome: MapWelcome
  open: boolean
  // The viewer went through the curtain (or skipped it).
  dismiss: () => void
  // "Ver bienvenida" in the settings popover. Null when there is nothing to show again.
  reopen: (() => void) | null
}

// Decides whether the welcome curtain is up, once per map and set of welcome
// settings, and remembers the viewer's passage. A preview shows it every time
// and remembers nothing.
export const useWelcome = ({
  mapId,
  settings,
  isEditorMode,
  isPreview,
  noContent,
}: UseWelcomeInput): WelcomeState => {
  const welcome = useMemo(() => resolveWelcome(settings), [settings])
  const hash = welcomeHash(welcome)
  const key = `${mapId}:${hash}:${isPreview}`
  // The key of the curtain the viewer already went through, or asked to see again.
  const [closedKey, setClosedKey] = useState<string | null>(null)
  const [reopenedKey, setReopenedKey] = useState<string | null>(null)

  const due = useMemo(
    () =>
      mapId !== null &&
      shouldShowWelcome({
        welcome,
        mapId,
        isEditorMode,
        noContent,
        storage: isPreview ? null : viewerStorage(),
      }),
    // `key` stands for the map, the welcome and the mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, isEditorMode, noContent]
  )

  const dismiss = useCallback(() => {
    if (mapId !== null && !isPreview) {
      markWelcomeHandled(mapId, hash)
      rememberWelcomeSeen(viewerStorage(), mapId, hash)
    }
    setClosedKey(key)
    setReopenedKey(null)
  }, [mapId, hash, isPreview, key])

  const canShow = mapId !== null && welcome.enabled && !isEditorMode && !noContent
  const open = canShow && (reopenedKey === key || (due && closedKey !== key))
  return {
    welcome,
    open,
    dismiss,
    reopen: canShow ? () => setReopenedKey(key) : null,
  }
}
