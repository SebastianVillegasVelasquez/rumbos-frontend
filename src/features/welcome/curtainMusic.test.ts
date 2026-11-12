import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { audioReducer, initialAudioState, isPlaying, type AudioEvent } from '../audio/audioState.ts'
import { mayAutostart } from '../audio/audioPrefs.ts'
import { createCurtainMusic, switchIsOn, type CurtainSession } from './curtainMusic.ts'

// A fake audio session that runs the real reducer and the real autostart rule,
// with an "element" that only records whether it would be sounding.
const fakeSession = (startAfterInteraction = true, muted = false) => {
  let state = { ...initialAudioState, active: true }
  let prefs = { muted, volume: null as number | null }
  const listeners = new Set<() => void>()
  const calls: string[] = []
  const dispatch = (event: AudioEvent) => {
    state = audioReducer(state, event)
    listeners.forEach((listener) => listener())
  }
  const session: CurtainSession = {
    getView: () => ({ state, prefs }),
    subscribe: (listener) => {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    setMuted: (value) => {
      calls.push(`setMuted(${value})`)
      prefs = { ...prefs, muted: value }
      dispatch({ type: 'mute', muted: value })
    },
    welcome: (phase) => {
      calls.push(`welcome(${phase})`)
      dispatch({ type: 'welcome', phase })
    },
    startFromGesture: () => {
      calls.push('startFromGesture')
      dispatch({
        type: 'gesture',
        autostart: mayAutostart({ startAfterInteraction, prefs, dataSaver: false }),
      })
    },
    hold: (held) => {
      calls.push(`hold(${held})`)
      dispatch({ type: 'hold', held })
    },
  }
  return {
    session,
    calls,
    sounding: () => isPlaying(state),
    prefs: () => prefs,
    // The viewer clicks anywhere in the page (the global first-gesture rule).
    pageClick: () =>
      dispatch({
        type: 'gesture',
        autostart: mayAutostart({ startAfterInteraction, prefs, dataSaver: false }),
      }),
  }
}

const setup = async (options: { startAfterInteraction?: boolean; muted?: boolean } = {}) => {
  const fake = fakeSession(options.startAfterInteraction ?? true, options.muted ?? false)
  const music = createCurtainMusic({
    loadSession: () => Promise.resolve(fake.session),
    readPrefs: () => fake.prefs(),
    startAfterInteraction: options.startAfterInteraction ?? true,
    dataSaver: () => false,
  })
  music.start()
  await Promise.resolve()
  return { fake, music }
}

describe('the switch shows what will happen at the button', () => {
  const base = { wants: null, muted: false, startAfterInteraction: true, dataSaver: false }
  it('follows the viewer first, then the usual rule', () => {
    assert.equal(switchIsOn({ ...base, wants: false }), false)
    assert.equal(switchIsOn({ ...base, wants: true, muted: true }), true)
    assert.equal(switchIsOn(base), true)
    assert.equal(switchIsOn({ ...base, muted: true }), false)
    assert.equal(switchIsOn({ ...base, startAfterInteraction: false }), false)
    assert.equal(switchIsOn({ ...base, dataSaver: true }), false)
  })
})

describe('the curtain music controller with a fake audio session', () => {
  it('shows the remembered state before the session exists', () => {
    const fake = fakeSession(true, true)
    const music = createCurtainMusic({
      loadSession: () => new Promise(() => {}),
      readPrefs: () => fake.prefs(),
      startAfterInteraction: true,
      dataSaver: () => false,
    })
    assert.equal(music.getSnapshot(), false)
  })

  it('a click on the switch does not start the music; the button does', async () => {
    const { fake, music } = await setup()
    assert.equal(music.getSnapshot(), true)
    fake.pageClick() // the session's own global first-gesture rule
    assert.equal(fake.sounding(), false, 'the waiting curtain ignores page clicks')
    music.begin()
    assert.equal(fake.sounding(), true)
  })

  it('switch off: nothing starts at the button and prefs.muted is set', async () => {
    const { fake, music } = await setup()
    music.toggle()
    assert.equal(music.getSnapshot(), false)
    assert.equal(fake.prefs().muted, true)
    music.begin()
    assert.equal(fake.sounding(), false)
  })

  it('switch off while the music already plays stops it at once', async () => {
    const { fake, music } = await setup()
    music.begin()
    assert.equal(fake.sounding(), true)
    music.toggle()
    assert.equal(fake.sounding(), false)
    assert.equal(music.getSnapshot(), false)
  })

  it('switch on resumes at once when the gesture already happened', async () => {
    const { fake, music } = await setup()
    music.toggle()
    music.begin()
    assert.equal(fake.sounding(), false)
    music.toggle()
    assert.equal(fake.sounding(), true)
    assert.equal(fake.prefs().muted, false)
  })

  it('switch on overrides an editor that does not autostart, at the button', async () => {
    const { fake, music } = await setup({ startAfterInteraction: false })
    assert.equal(music.getSnapshot(), false, 'the default follows the editor')
    music.toggle()
    assert.equal(music.getSnapshot(), true)
    assert.equal(fake.sounding(), false, 'still waiting for the button')
    music.begin()
    assert.equal(fake.sounding(), true)
  })

  it('the music is held while the video plays and comes back after', async () => {
    const { fake, music } = await setup()
    music.begin()
    music.hold(true)
    assert.equal(fake.sounding(), false)
    music.hold(false)
    assert.equal(fake.sounding(), true)
  })

  it('a muted viewer stays silent when the video ends', async () => {
    const { fake, music } = await setup()
    music.begin()
    music.hold(true)
    music.toggle()
    music.hold(false)
    assert.equal(fake.sounding(), false)
  })

  it('closing the curtain lets go of the hold and the wait', async () => {
    const { fake, music } = await setup()
    music.begin()
    music.hold(true)
    music.dispose()
    assert.equal(fake.sounding(), true)
    assert.equal(fake.calls.at(-1), 'welcome(closed)')
  })

  it('notifies listeners when the switch changes', async () => {
    const { music } = await setup()
    let seen = 0
    music.subscribe(() => seen++)
    music.toggle()
    assert.ok(seen >= 1)
  })
})

describe('a click that races the audio chunk is not lost', () => {
  const lateSetup = () => {
    const fake = fakeSession()
    let arrive: (session: CurtainSession) => void = () => {}
    const music = createCurtainMusic({
      loadSession: () => new Promise<CurtainSession>((resolve) => (arrive = resolve)),
      readPrefs: () => fake.prefs(),
      startAfterInteraction: true,
      dataSaver: () => false,
    })
    music.start()
    return { fake, music, arrive: () => arrive(fake.session) }
  }

  it('the switch shows the click at once, before the session exists', () => {
    const { music } = lateSetup()
    music.toggle()
    assert.equal(music.getSnapshot(), false)
  })

  it('off and the button before the chunk, then the chunk arrives: silent and remembered', async () => {
    const { fake, music, arrive } = lateSetup()
    music.toggle()
    music.begin()
    arrive()
    await Promise.resolve()
    assert.equal(fake.prefs().muted, true)
    assert.equal(fake.sounding(), false)
    fake.pageClick() // the next click anywhere must not start what they switched off
    assert.equal(fake.sounding(), false)
  })

  it('the curtain closing before the chunk still applies the choice', async () => {
    const { fake, music, arrive } = lateSetup()
    music.toggle()
    music.begin()
    music.dispose()
    arrive()
    await Promise.resolve()
    assert.equal(fake.prefs().muted, true)
    assert.equal(fake.sounding(), false)
    fake.pageClick()
    assert.equal(fake.sounding(), false)
    assert.equal(fake.calls.at(-1), 'welcome(closed)')
  })
})
