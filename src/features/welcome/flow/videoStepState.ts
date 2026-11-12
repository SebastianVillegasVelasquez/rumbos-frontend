import type { VideoSignal } from '../videoPlayer.ts'

// The phases of a video step, apart from the DOM so the rules are testable.
//
// The rule for "Problemas con el video?" (it corrects the first brief): it shows
// ONLY when no start signal (ready or play) arrives within VIDEO_LOAD_TIMEOUT_MS of
// the click, or the player reports an error. A long video that plays is never in
// trouble: with working events the only way to complete a mandatory video is
// `ended`. If the events never arrive (a blocked player, a browser that drops the
// messages) the way out is the recorded `fallback`.
export type VideoPhase =
  // Nothing loaded: the viewer has not clicked.
  | 'idle'
  // Clicked; waiting for the first start signal.
  | 'loading'
  // A start signal arrived (ready, playing or paused).
  | 'started'
  | 'ended'
  // No start signal in time, or the player reported an error.
  | 'trouble'

export type VideoEvent =
  { type: 'click' } | { type: 'signal'; signal: VideoSignal } | { type: 'timeout' }

export interface VideoState {
  phase: VideoPhase
  // The viewer used the way out: the step completes as `fallback`.
  usedFallback: boolean
}

export const initialVideoState: VideoState = { phase: 'idle', usedFallback: false }

export const videoReducer = (state: VideoState, event: VideoEvent): VideoState => {
  // The end is final: nothing that arrives later un-ends a video.
  if (state.phase === 'ended') return state
  switch (event.type) {
    case 'click':
      return state.phase === 'idle' ? { ...state, phase: 'loading' } : state
    case 'timeout':
      // Only a video still waiting for its first signal is in trouble.
      return state.phase === 'loading' ? { ...state, phase: 'trouble' } : state
    case 'signal':
      // Signals before the click are not ours (nothing is loaded before it).
      if (state.phase === 'idle') return state
      switch (event.signal) {
        case 'ended':
          return { ...state, phase: 'ended' }
        case 'error':
          return { ...state, phase: 'trouble' }
        default:
          // ready, playing, paused: the events work. A late one also recovers a
          // video that had been declared in trouble.
          return { ...state, phase: 'started' }
      }
  }
}

// The way out: used from the trouble state, with allowFallback. Kept apart from
// the reducer because it is the viewer's decision, not the player's.
export const takeVideoFallback = (state: VideoState): VideoState =>
  state.phase === 'trouble' ? { ...state, usedFallback: true } : state

export const showTroubleAction = (state: VideoState, allowFallback: boolean): boolean =>
  allowFallback && state.phase === 'trouble' && !state.usedFallback

export const videoCompleted = (state: VideoState): boolean =>
  state.phase === 'ended' || state.usedFallback
