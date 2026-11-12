import type { BrowserContext, Frame, Page } from '@playwright/test'

// Autoplay policies make real playback unreliable in CI, so every media element
// is stubbed: play() and pause() only flip `paused` and fire the events, nothing
// is downloaded or decoded. The real audio session (audioSession.ts), the real
// reducer and the real prefs storage still run; only the element is fake.
export const stubMedia = (context: BrowserContext) =>
  context.addInitScript(() => {
    const paused = new WeakMap<HTMLMediaElement, boolean>()
    const seen: HTMLMediaElement[] = []
    const proto = HTMLMediaElement.prototype
    Object.defineProperty(proto, 'paused', {
      configurable: true,
      get(this: HTMLMediaElement) {
        return paused.get(this) ?? true
      },
    })
    proto.play = function (this: HTMLMediaElement) {
      if (!seen.includes(this)) seen.push(this)
      paused.set(this, false)
      this.dispatchEvent(new Event('play'))
      return Promise.resolve()
    }
    proto.pause = function (this: HTMLMediaElement) {
      paused.set(this, true)
      this.dispatchEvent(new Event('pause'))
    }
    proto.load = function () {}
    // Nothing is fetched or decoded: some engines (WebKit on CI) have no codecs
    // and would fire a real `error` for the source, failing the track for a
    // reason that has nothing to do with the control under test.
    const sources = new WeakMap<HTMLMediaElement, string>()
    Object.defineProperty(proto, 'src', {
      configurable: true,
      get(this: HTMLMediaElement) {
        return sources.get(this) ?? ''
      },
      set(this: HTMLMediaElement, value: string) {
        sources.set(this, value)
      },
    })
    ;(window as unknown as { __media: HTMLMediaElement[] }).__media = seen
  })

export interface AudioSnapshot {
  muted: boolean
  wants: boolean | null
  playing: boolean
  held: boolean
  // The stubbed element: undefined until something called play().
  elementPaused: boolean | undefined
  elementVolume: number | undefined
  storedMuted: boolean | null
}

export const embedFrame = (page: Page): Frame =>
  page.frames().find((f) => f !== page.mainFrame() && f.url().includes('/embed'))!

// The real session's view and the stubbed element's state, read from inside the app.
export const snapshot = (page: Page): Promise<AudioSnapshot> =>
  embedFrame(page).evaluate(async () => {
    // Same URL the app imports, so this is the app's own singleton.
    const url = '/src/features/audio/audioSession.ts'
    const { audioSession } = (await import(
      /* @vite-ignore */ url
    )) as typeof import('../src/features/audio/audioSession.ts')
    const view = audioSession.getView()
    const media = (window as unknown as { __media: HTMLMediaElement[] }).__media
    const audio = media[0]
    const stored = (() => {
      try {
        const raw = window.localStorage.getItem('rumbos.audio.prefs')
        return raw ? (JSON.parse(raw) as { muted?: boolean }).muted === true : null
      } catch {
        return null
      }
    })()
    return {
      muted: view.prefs.muted,
      wants: view.state.wants,
      playing: view.playing,
      held: view.state.held,
      elementPaused: audio ? audio.paused : undefined,
      elementVolume: audio ? Math.round(audio.volume * 100) / 100 : undefined,
      storedMuted: stored,
    }
  })

export const giveMapsMusic = (page: Page) =>
  embedFrame(page).evaluate(async () => {
    const mock = (
      window as unknown as {
        __rumbosMock: { maps: () => { id: string }[]; addMusic: (id: string) => Promise<void> }
      }
    ).__rumbosMock
    for (const { id } of mock.maps()) await mock.addMusic(id)
  })
