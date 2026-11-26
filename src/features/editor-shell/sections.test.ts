import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createScrollMemory,
  isSectionId,
  readFullscreenOnOpen,
  readSection,
  rememberFullscreenOnOpen,
  rememberSection,
  resolveSection,
  sectionsFor,
  keepsMapVisible,
  spreadPlacement,
} from './sections.ts'

const memoryStore = () => {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  }
}

const ALL = ['map', 'activities', 'levels', 'heat', 'appearance', 'summary'] as const

describe('section memory', () => {
  it('starts on the map', () => {
    assert.equal(readSection(memoryStore(), ALL), 'map')
    assert.equal(readSection(null, ALL), 'map')
  })

  it('brings back the last section', () => {
    const store = memoryStore()
    rememberSection('appearance', store)
    assert.equal(readSection(store, ALL), 'appearance')
  })

  it('ignores a section that is not offered here or is unknown', () => {
    const store = memoryStore()
    rememberSection('heat', store)
    assert.equal(readSection(store, ['map', 'appearance']), 'map')
    store.setItem('rumbos.editor.section', 'nope')
    assert.equal(readSection(store, ALL), 'map')
    assert.equal(isSectionId('nope'), false)
  })

  it('survives a storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    assert.equal(readSection(broken, ALL), 'map')
    assert.doesNotThrow(() => rememberSection('levels', broken))
    assert.equal(readFullscreenOnOpen(broken), true)
  })
})

describe('fullscreen on open', () => {
  it('is on by default and can be turned off', () => {
    const store = memoryStore()
    assert.equal(readFullscreenOnOpen(store), true)
    rememberFullscreenOnOpen(false, store)
    assert.equal(readFullscreenOnOpen(store), false)
    rememberFullscreenOnOpen(true, store)
    assert.equal(readFullscreenOnOpen(store), true)
  })
})

describe('scroll memory', () => {
  it('keeps one position per key and defaults to the top', () => {
    const memory = createScrollMemory()
    assert.equal(memory.read('appearance:welcome'), 0)
    memory.save('appearance:welcome', 412.6)
    memory.save('levels', 10)
    assert.equal(memory.read('appearance:welcome'), 413)
    assert.equal(memory.read('levels'), 10)
    memory.save('levels', -5)
    assert.equal(memory.read('levels'), 0)
  })
})

describe('sectionsFor', () => {
  it('offers everything when the host can answer and there is a course', () => {
    assert.deepEqual(sectionsFor({ heat: true, levels: true }), [...ALL])
  })

  it('leaves out the heat map without a host and Niveles without a course', () => {
    assert.deepEqual(sectionsFor({ heat: false, levels: true }), [
      'map',
      'activities',
      'levels',
      'appearance',
      'summary',
    ])
    assert.deepEqual(sectionsFor({ heat: true, levels: false }), [
      'map',
      'activities',
      'heat',
      'appearance',
      'summary',
    ])
  })

  it('always keeps the map first', () => {
    assert.equal(sectionsFor({ heat: false, levels: false })[0], 'map')
  })
})

describe('resolveSection', () => {
  it('keeps a section that is on offer and falls back to the map otherwise', () => {
    assert.equal(resolveSection('appearance', ALL), 'appearance')
    assert.equal(resolveSection('heat', ['map', 'appearance']), 'map')
  })
})

describe('keepsMapVisible', () => {
  it('is true only for Actividades, so dragging onto the map still works', () => {
    assert.deepEqual(ALL.filter(keepsMapVisible), ['activities'])
  })
})

describe('spreadPlacement', () => {
  it('stays inside the level for any number of bubbles', () => {
    for (let n = 0; n < 500; n++) {
      const { x, y } = spreadPlacement(n)
      assert.ok(x >= 0.15 && x < 0.85, `x ${x} at ${n}`)
      assert.ok(y >= 0.2 && y < 0.8, `y ${y} at ${n}`)
    }
  })

  it('does not pile consecutive placements on one spot', () => {
    const spots = new Set(
      Array.from({ length: 8 }, (_, n) => {
        const { x, y } = spreadPlacement(n)
        return `${x.toFixed(3)},${y.toFixed(3)}`
      })
    )
    assert.equal(spots.size, 8)
  })
})
