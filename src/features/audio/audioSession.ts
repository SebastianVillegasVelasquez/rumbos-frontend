import { announce } from '../../components/ui/announce.ts'
import { es } from '../../i18n/es.ts'
import { isDataSaverActive } from '../../fx/dataSaverStore.ts'
import { isHostOverlayOpen, subscribeHostOverlay } from '../embed/hostOverlay.ts'
import { viewerStorage } from '../quests/viewerStorage.ts'
import {
  audioReducer,
  initialAudioState,
  isPlaying,
  type AudioEvent,
  type AudioState,
} from './audioState.ts'
import {
  effectiveVolume,
  mayAutostart,
  readAudioPrefs,
  rememberAudioPrefs,
  type AudioPrefs,
} from './audioPrefs.ts'
import { fadeStep } from './fade.ts'
import { guardSource, type SourceGuard } from './sourceGuard.ts'

// The one place that touches an <audio> element. It lives in a lazy chunk and is
// a module-level singleton on purpose: the music keeps playing across the 2D/3D
// switch and across levels that share a track, which a component state would
// lose whenever the stage remounts.
//
// Nothing is downloaded before the first play: preload is "none" and the source
// is only assigned when playback is about to start. That also holds under data
// saver, which additionally forbids autostart.

export interface AudioTrack {
  assetId: string
  url: string
  loop: boolean
  // The map's volume (0..1); the viewer's own volume wins when they set one.
  volume: number
  startAfterInteraction: boolean
  title: string
  credit: string
  // The backend says the file is gone: do not even try to download it.
  unavailable?: boolean
}

export interface AudioSessionView {
  state: AudioState
  prefs: AudioPrefs
  track: AudioTrack | null
  playing: boolean
}

let state: AudioState = initialAudioState
let prefs: AudioPrefs = readAudioPrefs(viewerStorage())
let track: AudioTrack | null = null
let element: HTMLAudioElement | null = null
let guard: SourceGuard | null = null
let level = 0
let frame = 0
let attached = false
const listeners = new Set<() => void>()

let view: AudioSessionView = { state, prefs, track, playing: false }

const targetVolume = () => (track ? effectiveVolume(prefs, track.volume) : 0)

// Said once per app start, when the music begins on its own.
let startAnnounced = false

const notify = () => {
  view = { state, prefs, track, playing: isPlaying(state) && track !== null }
  if (view.playing && state.autostarted && !startAnnounced) {
    startAnnounced = true
    announce(es.audio.startedAnnouncement)
  }
  listeners.forEach((listener) => listener())
}

const stopFade = () => {
  if (frame) cancelAnimationFrame(frame)
  frame = 0
}

// Walks `level` to `target` and, when it lands on silence, pauses.
const fadeTo = (target: number) => {
  stopFade()
  let last = performance.now()
  const tick = (now: number) => {
    frame = 0
    if (!element) return
    level = fadeStep(level, target, now - last)
    last = now
    element.volume = level
    if (level === target) {
      if (target === 0) element.pause()
      return
    }
    frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
}

const ensureElement = (): HTMLAudioElement => {
  if (!element) {
    element = new Audio()
    // Download only on play (and a Range request at that, which iOS needs).
    element.preload = 'none'
    // A failed source gets one more try; the second error ends it.
    guard = guardSource(element, {
      retry: () => {
        if (!element || !track) return
        element.src = track.url
        element.load()
        if (isPlaying(state)) element.play().catch(onPlayRejected)
      },
      fail: () => dispatch({ type: 'failed' }),
    })
  }
  return element
}

// A rejected play(). The cases below are not failures of the file: the browser
// wants a gesture first, a newer load interrupted this one, or the source is
// unsupported, which the element's own `error` event reports (and retries).
const onPlayRejected = (error: unknown) => {
  if (
    error instanceof DOMException &&
    (error.name === 'NotAllowedError' ||
      error.name === 'AbortError' ||
      error.name === 'NotSupportedError')
  )
    return
  dispatch({ type: 'failed' })
}

const startPlayback = () => {
  if (!track) return
  const audio = ensureElement()
  audio.loop = track.loop
  if (audio.dataset.assetId !== track.assetId) {
    audio.src = track.url
    audio.dataset.assetId = track.assetId
    level = 0
  }
  const target = targetVolume()
  if (audio.paused) {
    audio.volume = level
    audio.play().catch(onPlayRejected)
  }
  fadeTo(target)
}

const stopPlayback = () => {
  if (!element || element.paused) {
    stopFade()
    return
  }
  // A hidden tab does not run animation frames, so stop at once there.
  if (state.hidden) {
    stopFade()
    element.pause()
    level = 0
    return
  }
  fadeTo(0)
}

const sync = () => {
  if (isPlaying(state) && track) startPlayback()
  else stopPlayback()
}

const dispatch = (event: AudioEvent) => {
  state = audioReducer(state, event)
  sync()
  notify()
}

const autostartAllowed = () =>
  mayAutostart({
    startAfterInteraction: track?.startAfterInteraction ?? false,
    prefs,
    dataSaver: isDataSaverActive(),
  })

// First user activation anywhere on the page.
const GESTURES = ['pointerup', 'touchend', 'click', 'keydown'] as const
const onGesture = () => {
  GESTURES.forEach((name) => document.removeEventListener(name, onGesture, true))
  dispatch({ type: 'gesture', autostart: autostartAllowed() })
}

const attach = () => {
  if (attached) return
  attached = true
  GESTURES.forEach((name) => document.addEventListener(name, onGesture, true))
  document.addEventListener('visibilitychange', () =>
    dispatch({ type: 'visibility', hidden: document.visibilityState === 'hidden' })
  )
  subscribeHostOverlay(() => dispatch({ type: 'overlay', open: isHostOverlayOpen() }))
  state = {
    ...state,
    overlayOpen: isHostOverlayOpen(),
    hidden: document.visibilityState === 'hidden',
  }
}

export const audioSession = {
  getView: (): AudioSessionView => view,
  subscribe: (listener: () => void) => {
    listeners.add(listener)
    return () => void listeners.delete(listener)
  },

  // The stage showed or left the screen.
  setActive: (active: boolean) => {
    attach()
    dispatch({ type: 'active', active })
  },

  // The track of the level on screen. The same track keeps playing.
  setTrack: (next: AudioTrack) => {
    attach()
    const changed = track?.assetId !== next.assetId
    track = next
    if (changed) {
      if (element) element.pause()
      level = 0
      guard?.reset()
      dispatch({ type: 'trackChanged' })
      // Known to be missing: no download, no retry.
      if (next.unavailable) dispatch({ type: 'failed' })
    } else {
      if (element) element.loop = next.loop
      notify()
    }
    // A gesture that happened earlier (a tap in the level picker) already
    // unlocked audio; it only needs the editor's autostart rule applied now.
    if (state.gestureSeen) dispatch({ type: 'gesture', autostart: autostartAllowed() })
  },

  toggle: () => {
    const turningOff = state.wants === true
    prefs = { ...prefs, muted: turningOff }
    rememberAudioPrefs(prefs, viewerStorage())
    dispatch({ type: 'toggle' })
  },

  // The welcome curtain's button is the viewer's first gesture: apply the
  // autostart rule now, whether or not the music control has mounted yet (a
  // track that arrives later finds the gesture already seen).
  startFromGesture: () => {
    attach()
    dispatch({ type: 'gesture', autostart: autostartAllowed() })
  },

  // The curtain's "Sin música" switch: the viewer's mute, remembered, which
  // wins over the editor's setting. Called from a click, so it may start the
  // music when the viewer turns it back on.
  setMuted: (muted: boolean) => {
    prefs = { ...prefs, muted }
    rememberAudioPrefs(prefs, viewerStorage())
    if (muted && state.wants === true) dispatch({ type: 'toggle' })
    else if (!muted && state.wants === false) dispatch({ type: 'toggle' })
    else notify()
  },

  // The welcome video plays over a track that should not talk across it.
  hold: (held: boolean) => dispatch({ type: 'hold', held }),

  setVolume: (volume: number) => {
    prefs = { ...prefs, volume: Math.min(1, Math.max(0, volume)) }
    rememberAudioPrefs(prefs, viewerStorage())
    if (element && isPlaying(state)) {
      stopFade()
      level = targetVolume()
      element.volume = level
    }
    notify()
  },
}
