import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { forgetView, parseSavedView, readResume, rememberLevel, rememberView } from './resume.ts'

const memory = () => {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  }
}

const broken = {
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('blocked')
  },
}

describe('resume', () => {
  it('starts empty', () => {
    assert.deepEqual(readResume(memory(), 7), { lastMapId: null, views: {} })
    assert.deepEqual(readResume(null, 7), { lastMapId: null, views: {} })
  })

  it('remembers the last level and a view per level, per course', () => {
    const storage = memory()
    rememberLevel(storage, 7, 'map-a')
    rememberView(storage, 7, 'map-a', { x: 0.2, y: 0.8, zoom: 1.5 })
    rememberView(storage, 7, 'map-b', { x: 0.5, y: 0.5, zoom: 1 })
    rememberLevel(storage, 8, 'other')
    const data = readResume(storage, 7)
    assert.equal(data.lastMapId, 'map-a')
    assert.deepEqual(data.views['map-a'], { x: 0.2, y: 0.8, zoom: 1.5 })
    assert.deepEqual(Object.keys(data.views), ['map-a', 'map-b'])
    assert.equal(readResume(storage, 8).lastMapId, 'other')
  })

  it('forgets one view without touching the rest', () => {
    const storage = memory()
    rememberView(storage, 7, 'a', { x: 0.1, y: 0.1, zoom: 1 })
    rememberView(storage, 7, 'b', { x: 0.9, y: 0.9, zoom: 2 })
    forgetView(storage, 7, 'a')
    assert.deepEqual(Object.keys(readResume(storage, 7).views), ['b'])
  })

  it('does not rewrite storage when nothing changed', () => {
    const storage = memory()
    rememberView(storage, 7, 'a', { x: 0.1, y: 0.1, zoom: 1 })
    const before = storage.data.get('rumbos.resume.7')
    rememberView(storage, 7, 'a', { x: 0.1, y: 0.1, zoom: 1 })
    assert.equal(storage.data.get('rumbos.resume.7'), before)
  })

  it('keeps only the most recent views', () => {
    const storage = memory()
    for (let i = 0; i < 40; i++) rememberView(storage, 7, `m${i}`, { x: 0.5, y: 0.5, zoom: 1 })
    const ids = Object.keys(readResume(storage, 7).views)
    assert.equal(ids.length, 30)
    assert.equal(ids.at(-1), 'm39')
  })

  it('ignores garbage in storage', () => {
    for (const raw of ['not json', '42', 'null', '{"views":5}', '{"lastMapId":7}']) {
      const storage = memory()
      storage.setItem('rumbos.resume.7', raw)
      assert.deepEqual(readResume(storage, 7), { lastMapId: null, views: {} }, raw)
    }
  })

  it('drops invalid views and clamps the zoom', () => {
    assert.equal(parseSavedView({ x: 2, y: 0.5, zoom: 1 }), null)
    assert.equal(parseSavedView({ x: 0.5, y: 0.5, zoom: NaN }), null)
    assert.equal(parseSavedView('x'), null)
    assert.equal(parseSavedView({ x: 0.5, y: 0.5, zoom: 9 })?.zoom, 3)
    assert.equal(parseSavedView({ x: 0.5, y: 0.5, zoom: 0.2 })?.zoom, 1)
  })

  it('survives storage that throws', () => {
    assert.deepEqual(readResume(broken, 7), { lastMapId: null, views: {} })
    assert.doesNotThrow(() => rememberLevel(broken, 7, 'a'))
    assert.doesNotThrow(() => rememberView(broken, 7, 'a', { x: 0.5, y: 0.5, zoom: 1 }))
    assert.doesNotThrow(() => forgetView(broken, 7, 'a'))
  })
})
