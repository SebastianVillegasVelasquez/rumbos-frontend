import { useCallback, useMemo, useState } from 'react'
import type { MapSettings, MapWelcome } from '../course-map/data/types.ts'
import { useEmbed } from '../embed/EmbedContext.ts'
import { viewerStorage } from '../quests/viewerStorage.ts'
import {
  markWelcomeHandled,
  rememberWelcomeSeen,
  resolveWelcome,
  shouldShowWelcome,
  welcomeHash,
} from './welcome.ts'
import { useFlowGate, type FlowGate } from './flow/useFlowGate.ts'

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
  // Set when the map has a configured flow (`welcome.steps`): the flow player
  // takes the place of the legacy curtain. Null: the legacy curtain.
  flow: FlowGate | null
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
  const embed = useEmbed()
  // Maps without steps keep the legacy curtain as it is; the equivalent flow is
  // what the editor converts it to on its first save.
  const steps = welcome.steps && welcome.steps.length > 0 ? welcome.steps : null
  const flow = useFlowGate({
    mapId,
    steps,
    hash,
    show: welcome.show,
    allowed: welcome.enabled && !isEditorMode && !noContent,
    isPreview,
    embed,
  })
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
  if (steps !== null) {
    return {
      welcome,
      open: canShow && (flow.state.status === 'checking' || flow.state.status === 'run'),
      dismiss: () => flow.finish(),
      reopen: canShow ? flow.reopen : null,
      flow,
    }
  }
  const open = canShow && (reopenedKey === key || (due && closedKey !== key))
  return {
    welcome,
    open,
    dismiss,
    reopen: canShow ? () => setReopenedKey(key) : null,
    flow: null,
  }
}
