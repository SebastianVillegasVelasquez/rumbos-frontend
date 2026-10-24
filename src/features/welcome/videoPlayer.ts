import type { VideoProvider } from '../content/contentTypes.ts'
import { isVideoId } from '../content/validateContent.ts'

// The welcome video plays inside the curtain, so the curtain must know when it
// ends. Both providers talk to their embedding page through postMessage; the
// messages are read here with no provider script loaded.

const ORIGIN: Record<VideoProvider, string> = {
  youtube: 'https://www.youtube-nocookie.com',
  vimeo: 'https://player.vimeo.com',
}

export const playerOrigin = (provider: VideoProvider) => ORIGIN[provider]

// The address of the player for a validated id, started on load (the viewer's
// click on "Reproducir" is the gesture that allows it). Never built from text.
export const playerUrl = (provider: VideoProvider, videoId: string): string | null => {
  if (!isVideoId(provider, videoId)) return null
  return provider === 'youtube'
    ? `${ORIGIN.youtube}/embed/${videoId}?rel=0&autoplay=1&playsinline=1&enablejsapi=1`
    : `${ORIGIN.vimeo}/video/${videoId}?dnt=1&autoplay=1&playsinline=1`
}

// What to post to the frame once it loads, to be told when the video ends.
export const subscribeMessages = (provider: VideoProvider): string[] =>
  provider === 'youtube'
    ? [
        JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
        JSON.stringify({ event: 'command', func: 'addEventListener', args: ['onStateChange'] }),
      ]
    : [JSON.stringify({ method: 'addEventListener', value: 'finish' })]

const asObject = (data: unknown): Record<string, unknown> | null => {
  if (typeof data === 'string') {
    try {
      const parsed: unknown = JSON.parse(data)
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : null
    } catch {
      return null
    }
  }
  return typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : null
}

// True when a message from the player says the video finished.
export const isEndedMessage = (provider: VideoProvider, data: unknown): boolean => {
  const message = asObject(data)
  if (!message) return false
  if (provider === 'vimeo') return message.event === 'finish'
  if (message.event === 'onStateChange') return message.info === 0
  if (message.event === 'infoDelivery') {
    const info = message.info
    return (
      typeof info === 'object' &&
      info !== null &&
      (info as { playerState?: unknown }).playerState === 0
    )
  }
  return false
}
