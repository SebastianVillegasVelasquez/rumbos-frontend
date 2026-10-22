import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DEFAULT_PREFS,
  effectiveVolume,
  mayAutostart,
  readAudioPrefs,
  rememberAudioPrefs,
} from './audioPrefs.ts'

const memory = () => {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  }
}

describe('audio prefs', () => {
  it('starts with nothing chosen', () => {
    assert.deepEqual(readAudioPrefs(memory()), DEFAULT_PREFS)
    assert.deepEqual(readAudioPrefs(null), DEFAULT_PREFS)
  })

  it('round-trips muted and volume', () => {
    const storage = memory()
    rememberAudioPrefs({ muted: true, volume: 0.25 }, storage)
    assert.deepEqual(readAudioPrefs(storage), { muted: true, volume: 0.25 })
  })

  it('validates what it reads', () => {
    for (const raw of ['nope', '5', 'null', '{"muted":"yes","volume":"loud"}']) {
      const storage = memory()
      storage.setItem('rumbos.audio.prefs', raw)
      assert.deepEqual(readAudioPrefs(storage), DEFAULT_PREFS, raw)
    }
    const storage = memory()
    storage.setItem('rumbos.audio.prefs', '{"muted":false,"volume":7}')
    assert.equal(readAudioPrefs(storage).volume, 1)
  })

  it('survives storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    assert.deepEqual(readAudioPrefs(broken), DEFAULT_PREFS)
    assert.doesNotThrow(() => rememberAudioPrefs(DEFAULT_PREFS, broken))
  })
})

describe('effectiveVolume', () => {
  it("uses the viewer's volume, else the map's", () => {
    assert.equal(effectiveVolume({ muted: false, volume: 0.9 }, 0.4), 0.9)
    assert.equal(effectiveVolume(DEFAULT_PREFS, 0.4), 0.4)
    assert.equal(effectiveVolume(DEFAULT_PREFS, 3), 1)
  })
})

describe('mayAutostart', () => {
  const allowed = { startAfterInteraction: true, prefs: DEFAULT_PREFS, dataSaver: false }
  it('needs the editor to ask, the viewer not to have muted and data saver off', () => {
    assert.equal(mayAutostart(allowed), true)
    assert.equal(mayAutostart({ ...allowed, startAfterInteraction: false }), false)
    assert.equal(mayAutostart({ ...allowed, prefs: { muted: true, volume: null } }), false)
    assert.equal(mayAutostart({ ...allowed, dataSaver: true }), false)
  })
})
