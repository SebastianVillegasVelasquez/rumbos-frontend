import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { createCurtainMusic, type CurtainSession } from '../welcome/curtainMusic.ts'
import { wantsMusic, type AudioState } from './audioState.ts'

// The welcome switch and the HUD audio control are two views of one session: after
// any sequence of toggles on either, they must show the same state, and it must be
// `!prefs.muted`. This runs the REAL audio session (its reducer, prefs and
// storage) and the REAL curtain controller, with a minimal browser shim around
// them; a seeded random sequence of 50 toggles picks a control each time.

const listeners = new Map<string, Array<() => void>>()
const storage = new Map<string, string>()

class FakeAudio {
  paused = true
  volume = 0
  loop = false
  preload = ''
  src = ''
  dataset: Record<string, string> = {}
  addEventListener() {}
  removeEventListener() {}
  load() {}
  play() {
    this.paused = false
    return Promise.resolve()
  }
  pause() {
    this.paused = true
  }
}

let session: CurtainSession & {
  toggle: () => void
  setTrack: (track: unknown) => void
  setActive: (active: boolean) => void
  getView: () => { prefs: { muted: boolean }; state: Parameters<typeof wantsMusic>[0] }
}

before(async () => {
  const g = globalThis as unknown as Record<string, unknown>
  const target = {
    addEventListener: (name: string, fn: () => void) =>
      listeners.set(name, [...(listeners.get(name) ?? []), fn]),
    removeEventListener: () => {},
  }
  g.document = { ...target, visibilityState: 'visible' }
  g.window = {
    ...target,
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
    },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  }
  g.localStorage = (g.window as { localStorage: unknown }).localStorage
  g.Audio = FakeAudio
  g.requestAnimationFrame = (fn: (t: number) => void) => setTimeout(() => fn(performance.now()), 0)
  g.cancelAnimationFrame = (id: number) => clearTimeout(id)
  session = (await import('./audioSession.ts')).audioSession as unknown as typeof session
})

// A small seeded generator: the same sequence every run.
const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

describe('the welcome switch and the HUD control', () => {
  for (const seed of [1, 7, 42]) {
    it(`always agree after 50 random toggles across both (seed ${seed})`, async () => {
      session.setTrack({
        assetId: `track-${seed}`,
        url: '/t.mp3',
        loop: true,
        volume: 0.4,
        startAfterInteraction: true,
        title: 't',
        credit: '',
        license: null,
        coverUrl: null,
      })
      session.setActive(true)
      const curtain = createCurtainMusic({
        loadSession: async () => session,
        readPrefs: () => ({ muted: false, volume: null }),
        startAfterInteraction: true,
        dataSaver: () => false,
      })
      curtain.start()
      await new Promise((resolve) => setTimeout(resolve, 0))
      // The primary button was pressed: the curtain no longer holds the start.
      curtain.begin()

      const next = seeded(seed)
      for (let i = 0; i < 50; i++) {
        const useSwitch = next() < 0.5
        if (useSwitch) curtain.toggle()
        else session.toggle()
        const view = session.getView() as unknown as {
          prefs: { muted: boolean }
          state: AudioState
        }
        const hud = wantsMusic(view.state)
        const welcome = curtain.getSnapshot()
        assert.equal(
          welcome,
          hud,
          `toggle ${i + 1} (${useSwitch ? 'switch' : 'HUD'}): switch=${welcome} HUD=${hud}`
        )
        assert.equal(hud, !view.prefs.muted, `toggle ${i + 1}: prefs.muted is the source of truth`)
        const stored = JSON.parse(storage.get('rumbos.audio.prefs') ?? '{}') as { muted?: boolean }
        assert.equal(stored.muted === true, view.prefs.muted, `toggle ${i + 1}: remembered`)
      }
      curtain.dispose()
    })
  }
})
