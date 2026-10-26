import { es } from '../../i18n/es.ts'
import type { VideoProvider } from '../content/contentTypes.ts'

const text = es.welcome

// The low-emphasis footnote. It is plain text next to a video, never part of a
// button. A dictionary that returns an empty string hides it.
export const videoHostNote = (
  provider: VideoProvider,
  format: (provider: string) => string = text.videoHost
): string => format(text.providers[provider]).trim()

export type CurtainButtonId = 'primary' | 'watch' | 'music' | 'fullscreen'

export interface CurtainButton {
  id: CurtainButtonId
  label: string
}

// Every button the welcome curtain shows, with its visible label (which is also
// its accessible name). None of them names the video provider.
export const curtainButtons = (state: {
  showPlay: boolean
  offerOptionalVideo: boolean
  hasMusic: boolean
  canFullscreen: boolean
}): CurtainButton[] => {
  const buttons: CurtainButton[] = [
    { id: 'primary', label: state.showPlay ? text.play : text.start },
  ]
  if (state.offerOptionalVideo) buttons.push({ id: 'watch', label: text.watchVideo })
  if (state.hasMusic) buttons.push({ id: 'music', label: text.musicLabel })
  if (state.canFullscreen) buttons.push({ id: 'fullscreen', label: text.fullscreen })
  return buttons
}
