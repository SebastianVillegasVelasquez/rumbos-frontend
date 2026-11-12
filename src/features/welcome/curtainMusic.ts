import { mayAutostart, type AudioPrefs } from '../audio/audioPrefs.ts'

// What the welcome curtain does about the music, apart from React so it can be
// tested with a fake audio session. The audio session (a lazy chunk, a
// singleton) holds the truth: `prefs.muted` and what the viewer wants. This
// controller only asks it things, and replays what the viewer did if they did it
// before the chunk arrived (a click that raced the download must not be lost).

// The slice of the audio session the curtain uses.
export interface CurtainSession {
  getView(): { state: { wants: boolean | null }; prefs: { muted: boolean } }
  subscribe(listener: () => void): () => void
  setMuted(muted: boolean): void
  welcome(phase: 'waiting' | 'started' | 'closed'): void
  startFromGesture(): void
  hold(held: boolean): void
}

export interface CurtainMusicOptions {
  loadSession: () => Promise<CurtainSession>
  // The remembered prefs, for what the switch shows before the session exists.
  readPrefs: () => AudioPrefs
  // The editor's "Iniciar al empezar": what the music does when the viewer
  // leaves the switch alone.
  startAfterInteraction: boolean
  dataSaver: () => boolean
}

// What the switch shows is what will happen at the curtain's button: the
// viewer's own choice if there is one, else the usual autostart rule.
export const switchIsOn = (input: {
  wants: boolean | null
  muted: boolean
  startAfterInteraction: boolean
  dataSaver: boolean
}): boolean =>
  input.wants ??
  mayAutostart({
    startAfterInteraction: input.startAfterInteraction,
    prefs: { muted: input.muted, volume: null },
    dataSaver: input.dataSaver,
  })

export interface CurtainMusic {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => boolean
  start: () => void
  dispose: () => void
  toggle: () => void
  // The curtain's primary button: the viewer's gesture. Starts the music if
  // the switch is on.
  begin: () => void
  // The welcome video starts or stops being heard.
  hold: (held: boolean) => void
}

export const createCurtainMusic = (options: CurtainMusicOptions): CurtainMusic => {
  const listeners = new Set<() => void>()
  let session: CurtainSession | null = null
  let unsubscribe: (() => void) | null = null
  // One per start(). A run that was disposed before its session arrived still
  // applies what the viewer did (the choice must not be lost when the curtain
  // closes first), then lets go.
  interface Run {
    disposed: boolean
    left: { choice: boolean | null; began: boolean } | null
  }
  let current: Run | null = null
  // What the viewer did before the session arrived, replayed when it does.
  let choice: boolean | null = null
  let began = false
  let held = false

  const read = (): boolean => {
    if (session) {
      const view = session.getView()
      return switchIsOn({
        wants: view.state.wants,
        muted: view.prefs.muted,
        startAfterInteraction: options.startAfterInteraction,
        dataSaver: options.dataSaver(),
      })
    }
    return switchIsOn({
      wants: choice === null ? null : !choice,
      muted: choice ?? options.readPrefs().muted,
      startAfterInteraction: options.startAfterInteraction,
      dataSaver: options.dataSaver(),
    })
  }

  const emit = () => listeners.forEach((listener) => listener())

  return {
    subscribe: (listener) => {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    getSnapshot: read,

    start: () => {
      const run: Run = { disposed: false, left: null }
      current = run
      void options.loadSession().then((loaded) => {
        if (run.disposed) {
          if (run.left?.choice != null) loaded.setMuted(run.left.choice)
          if (run.left?.began) {
            loaded.welcome('started')
            loaded.startFromGesture()
          }
          loaded.welcome('closed')
          return
        }
        session = loaded
        unsubscribe = loaded.subscribe(emit)
        loaded.welcome('waiting')
        if (choice !== null) loaded.setMuted(choice)
        if (began) {
          loaded.welcome('started')
          loaded.startFromGesture()
        }
        if (held) loaded.hold(true)
        emit()
      })
    },

    dispose: () => {
      if (current) {
        current.disposed = true
        current.left = { choice, began }
        current = null
      }
      unsubscribe?.()
      unsubscribe = null
      // However the curtain closes, the music is no longer held or waiting.
      session?.welcome('closed')
      session = null
      choice = null
      began = false
      held = false
    },

    toggle: () => {
      const muted = read() // currently on => the new state is muted
      choice = muted
      session?.setMuted(muted)
      emit()
    },

    begin: () => {
      began = true
      if (!session) return
      session.welcome('started')
      session.startFromGesture()
    },

    hold: (next) => {
      held = next
      session?.hold(next)
    },
  }
}
