// When the background music plays. Pure, so the rules are tested without a
// browser; audioSession.ts feeds it events and audioEngine.ts obeys the result.
//
//   - It never plays before a user gesture: a tap, a click or a key press.
//   - It starts by itself, after the first gesture, only when the editor asked
//     for that, the viewer has not switched it off and data saver is off. The
//     decision (`autostart`) is made by the caller and arrives with the gesture.
//   - The viewer's own button always wins afterwards.
//   - It pauses under a host overlay (an activity popup) and while the tab is
//     hidden, and resumes when they end, if it was playing.

export interface AudioState {
  // What the viewer wants: null until they or an autostart decide.
  wants: boolean | null
  gestureSeen: boolean
  // A host overlay is open above the app.
  overlayOpen: boolean
  // The tab is not visible.
  hidden: boolean
  // The control is on screen. Leaving the stage (the level picker) pauses the
  // music without forgetting what the viewer wanted.
  active: boolean
  // The file could not be played.
  failed: boolean
}

export type AudioEvent =
  // The first user activation. `autostart` is true when the music may begin
  // without the viewer asking.
  | { type: 'gesture'; autostart: boolean }
  // The viewer pressed the button.
  | { type: 'toggle' }
  | { type: 'overlay'; open: boolean }
  | { type: 'visibility'; hidden: boolean }
  | { type: 'active'; active: boolean }
  | { type: 'failed' }
  // A different track was loaded: forget the failure, keep what the viewer wants.
  | { type: 'trackChanged' }

export const initialAudioState: AudioState = {
  wants: null,
  gestureSeen: false,
  overlayOpen: false,
  hidden: false,
  active: false,
  failed: false,
}

export const audioReducer = (state: AudioState, event: AudioEvent): AudioState => {
  switch (event.type) {
    case 'gesture':
      return {
        ...state,
        gestureSeen: true,
        wants: state.wants === null && event.autostart ? true : state.wants,
      }
    case 'toggle':
      // Pressing the button is itself a gesture.
      return { ...state, gestureSeen: true, wants: state.wants !== true, failed: false }
    case 'overlay':
      return { ...state, overlayOpen: event.open }
    case 'visibility':
      return { ...state, hidden: event.hidden }
    case 'active':
      return { ...state, active: event.active }
    case 'failed':
      return { ...state, failed: true }
    case 'trackChanged':
      return { ...state, failed: false }
  }
}

// Should sound be coming out right now?
export const isPlaying = (state: AudioState): boolean =>
  state.wants === true &&
  state.gestureSeen &&
  state.active &&
  !state.overlayOpen &&
  !state.hidden &&
  !state.failed

// The button's state: the viewer wants music, even if something is holding it
// for a moment.
export const wantsMusic = (state: AudioState): boolean => state.wants === true
