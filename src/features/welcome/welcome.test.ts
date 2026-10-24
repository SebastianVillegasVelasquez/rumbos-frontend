import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import type { MapWelcome } from '../course-map/data/types.ts'
import {
  DEFAULT_WELCOME,
  hasOptionalVideo,
  markWelcomeHandled,
  primaryAction,
  readWelcomeSeen,
  rememberWelcomeSeen,
  resetWelcomeSession,
  resolveWelcome,
  shouldShowWelcome,
  welcomeHash,
  validateWelcome,
  welcomeTitle,
} from './welcome.ts'

const video = { provider: 'youtube', videoId: 'dQw4w9WgXcQ' } as const
const memory = () => {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
  }
}

describe('resolveWelcome', () => {
  it('turns null and absent into the defaults', () => {
    assert.deepEqual(resolveWelcome(null), DEFAULT_WELCOME)
    assert.deepEqual(resolveWelcome(undefined), DEFAULT_WELCOME)
    assert.equal(DEFAULT_WELCOME.enabled, true)
    assert.equal(DEFAULT_WELCOME.show, 'first_visit')
    assert.equal(DEFAULT_WELCOME.playOnEnter, true)
  })

  it('keeps what the editor set', () => {
    assert.equal(resolveWelcome({ ...DEFAULT_WELCOME, show: 'always' }).show, 'always')
  })
})

describe('welcomeTitle', () => {
  const names = { courseName: 'Ecología', mapTitle: 'Nivel 1' }
  const fallback = 'Bienvenido a {curso}'

  it('uses the default title with the course name', () => {
    assert.equal(welcomeTitle(DEFAULT_WELCOME, fallback, names), 'Bienvenido a Ecología')
  })

  it('falls back to the map title when the host sends no course name', () => {
    assert.equal(
      welcomeTitle(DEFAULT_WELCOME, fallback, { courseName: null, mapTitle: 'Nivel 1' }),
      'Bienvenido a Nivel 1'
    )
  })

  it('replaces every {curso} and leaves a title without one alone', () => {
    const two = { ...DEFAULT_WELCOME, title: '{curso}: tu viaje por {curso}' }
    assert.equal(welcomeTitle(two, fallback, names), 'Ecología: tu viaje por Ecología')
    const none = { ...DEFAULT_WELCOME, title: 'Hola' }
    assert.equal(welcomeTitle(none, fallback, names), 'Hola')
  })

  it('treats a blank title as unset and does not interpret replacement patterns', () => {
    const blank = { ...DEFAULT_WELCOME, title: '   ' }
    assert.equal(welcomeTitle(blank, fallback, names), 'Bienvenido a Ecología')
    const tricky = '$& $1 $`'
    assert.equal(
      welcomeTitle(DEFAULT_WELCOME, fallback, { courseName: tricky, mapTitle: 'x' }),
      `Bienvenido a ${tricky}`
    )
  })
})

describe('buttons', () => {
  const base: MapWelcome = DEFAULT_WELCOME
  it('says Reproducir only with a video that plays on entering', () => {
    assert.equal(primaryAction({ ...base, video }), 'play')
    assert.equal(primaryAction({ ...base, video, playOnEnter: false }), 'start')
    assert.equal(primaryAction(base), 'start')
  })

  it('offers the video as a secondary action only when it does not play on entering', () => {
    assert.equal(hasOptionalVideo({ ...base, video, playOnEnter: false }), true)
    assert.equal(hasOptionalVideo({ ...base, video }), false)
    assert.equal(hasOptionalVideo(base), false)
  })
})

describe('shouldShowWelcome', () => {
  beforeEach(resetWelcomeSession)
  const input = (over: Partial<Parameters<typeof shouldShowWelcome>[0]> = {}) => ({
    welcome: DEFAULT_WELCOME,
    mapId: 'm1',
    isEditorMode: false,
    noContent: false,
    storage: memory(),
    ...over,
  })

  it('shows on the first visit, then not once seen', () => {
    const storage = memory()
    assert.equal(shouldShowWelcome(input({ storage })), true)
    rememberWelcomeSeen(storage, 'm1', welcomeHash(DEFAULT_WELCOME))
    assert.equal(shouldShowWelcome(input({ storage })), false)
  })

  it('shows again when the editor changes the welcome', () => {
    const storage = memory()
    rememberWelcomeSeen(storage, 'm1', welcomeHash(DEFAULT_WELCOME))
    const changed = { ...DEFAULT_WELCOME, message: 'Nuevo' }
    assert.equal(shouldShowWelcome(input({ storage, welcome: changed })), true)
  })

  it('is per map', () => {
    const storage = memory()
    rememberWelcomeSeen(storage, 'm1', welcomeHash(DEFAULT_WELCOME))
    assert.equal(shouldShowWelcome(input({ storage, mapId: 'm2' })), true)
  })

  it('"always" shows on every app start but not twice in one session', () => {
    const always = { ...DEFAULT_WELCOME, show: 'always' as const }
    const storage = memory()
    rememberWelcomeSeen(storage, 'm1', welcomeHash(always))
    assert.equal(shouldShowWelcome(input({ storage, welcome: always })), true)
    markWelcomeHandled('m1', welcomeHash(always))
    assert.equal(shouldShowWelcome(input({ storage, welcome: always })), false)
  })

  it('never shows when disabled, to an editor in editor mode, or with no content', () => {
    const disabled = { ...DEFAULT_WELCOME, enabled: false }
    assert.equal(shouldShowWelcome(input({ welcome: disabled })), false)
    assert.equal(shouldShowWelcome(input({ isEditorMode: true })), false)
    assert.equal(shouldShowWelcome(input({ noContent: true })), false)
  })

  it('does not nag when storage is blocked', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
    }
    assert.equal(readWelcomeSeen(broken, 'm1', 'x'), true)
    assert.equal(shouldShowWelcome(input({ storage: broken })), false)
  })

  it('treats no storage at all as unseen', () => {
    assert.equal(shouldShowWelcome(input({ storage: null })), true)
  })
})

describe('welcomeHash', () => {
  it('is stable and sensitive to every setting', () => {
    assert.equal(welcomeHash(DEFAULT_WELCOME), welcomeHash({ ...DEFAULT_WELCOME }))
    assert.notEqual(welcomeHash(DEFAULT_WELCOME), welcomeHash({ ...DEFAULT_WELCOME, video }))
    assert.notEqual(
      welcomeHash(DEFAULT_WELCOME),
      welcomeHash({ ...DEFAULT_WELCOME, show: 'always' })
    )
  })
})

describe('validateWelcome', () => {
  it('accepts null, the defaults and a full welcome', () => {
    assert.deepEqual(validateWelcome(null), [])
    assert.deepEqual(validateWelcome(DEFAULT_WELCOME), [])
    assert.deepEqual(
      validateWelcome({ ...DEFAULT_WELCOME, title: 'Hola, {curso}', message: 'x', video }),
      []
    )
  })

  it('refuses what the backend refuses', () => {
    assert.deepEqual(validateWelcome({ ...DEFAULT_WELCOME, title: 'x'.repeat(121) }), [
      'title_too_long',
    ])
    assert.deepEqual(validateWelcome({ ...DEFAULT_WELCOME, title: 'Hola {nombre}' }), [
      'title_placeholder',
    ])
    assert.deepEqual(validateWelcome({ ...DEFAULT_WELCOME, message: 'x'.repeat(301) }), [
      'message_too_long',
    ])
    assert.deepEqual(
      validateWelcome({ ...DEFAULT_WELCOME, video: { provider: 'vimeo', videoId: 'no' } }),
      ['video_invalid']
    )
  })
})
