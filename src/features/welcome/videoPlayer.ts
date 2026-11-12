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
    : ['finish', 'play', 'pause', 'error'].map((value) =>
        JSON.stringify({ method: 'addEventListener', value })
      )

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

export type Playback = 'playing' | 'paused' | 'ended'

const YOUTUBE_STATES: Record<number, Playback> = { 0: 'ended', 1: 'playing', 2: 'paused' }

// What a message from the player says about playback, or null when it says
// nothing about it. The curtain never assumes the video plays: autoplay may be
// refused (Safari is stricter), and then the player waits behind its own play
// button.
export const playbackOf = (provider: VideoProvider, data: unknown): Playback | null => {
  const message = asObject(data)
  if (!message) return null
  if (provider === 'vimeo') {
    if (message.event === 'play') return 'playing'
    if (message.event === 'pause') return 'paused'
    return message.event === 'finish' ? 'ended' : null
  }
  const state =
    message.event === 'onStateChange'
      ? message.info
      : message.event === 'infoDelivery' &&
          typeof message.info === 'object' &&
          message.info !== null
        ? (message.info as { playerState?: unknown }).playerState
        : undefined
  return typeof state === 'number' ? (YOUTUBE_STATES[state] ?? null) : null
}

// Everything a player may tell us, for the welcome flow: it needs the start
// signal (ready or play) and the error, not only the playback state.
export type VideoSignal = 'ready' | 'playing' | 'paused' | 'ended' | 'error'

// Written from the providers documentation, with no SDK:
// - YouTube (enablejsapi=1): `onReady`, `onStateChange` (info: playerState),
//   `infoDelivery` (info.playerState) and `onError` (info: error code).
// - Vimeo: `ready`, `play`, `pause`, `finish` and `error`, the last four only
//   after addEventListener (see subscribeMessages).
export const signalOf = (provider: VideoProvider, data: unknown): VideoSignal | null => {
  const message = asObject(data)
  if (!message) return null
  if (provider === 'vimeo') {
    if (message.event === 'ready') return 'ready'
    if (message.event === 'error') return 'error'
  } else {
    if (message.event === 'onReady') return 'ready'
    if (message.event === 'onError') return 'error'
  }
  return playbackOf(provider, data)
}

// How long after the click the iframe may take to give a start signal (ready or
// play) or fire its load event. ONE constant for the curtain and the welcome flow:
// when it passes without a start signal the video counts as not working (the flow
// then offers its way out). It never limits how long a working video plays.
export const VIDEO_LOAD_TIMEOUT_MS = 10_000

export type VideoLoad = 'loading' | 'loaded' | 'failed'

// The only signals a cross-origin iframe gives: its load event and our own
// timeout. A player page that loads but shows its own error (a removed video,
// a blocked embed) still fires load, so it counts as loaded: that is a known
// limit, see docs/DECISIONS-hud.md.
export const nextVideoLoad = (state: VideoLoad, event: 'load' | 'timeout'): VideoLoad => {
  if (event === 'load') return 'loaded'
  return state === 'loading' ? 'failed' : state
}
