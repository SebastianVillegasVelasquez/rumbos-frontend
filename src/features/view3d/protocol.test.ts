import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { MAX_POINTS, isCssVars, isHostMessage, isPageMessage, type Point3D } from './protocol.ts'

const point: Point3D = {
  id: 'b1',
  zoneId: 2,
  title: null,
  description: 'Texto',
  state: 'available',
}

const init = {
  type: 'rumbos:init',
  v: 1,
  scene: 'region-encuentros',
  locale: 'es',
  reducedMotion: false,
  theme: { cssVars: { '--r3d-ink': '#12284a' } },
  points: [point],
}

describe('isHostMessage', () => {
  it('accepts every well-formed host message', () => {
    assert.ok(isHostMessage(init))
    assert.ok(isHostMessage({ type: 'rumbos:states', v: 1, states: { b1: 'complete' } }))
    assert.ok(isHostMessage({ type: 'rumbos:locale', v: 1, locale: 'en' }))
    assert.ok(isHostMessage({ type: 'rumbos:theme', v: 1, cssVars: {} }))
    assert.ok(isHostMessage({ type: 'rumbos:focus', v: 1, pointId: 'b1' }))
  })

  it('rejects other versions, unknown types and non-objects', () => {
    assert.equal(isHostMessage({ ...init, v: 2 }), false)
    assert.equal(isHostMessage({ type: 'rumbos:nope', v: 1 }), false)
    assert.equal(isHostMessage(null), false)
    assert.equal(isHostMessage('rumbos:init'), false)
    assert.equal(isHostMessage([init]), false)
  })

  it('rejects malformed points', () => {
    for (const bad of [
      { ...point, state: 'open' },
      { ...point, zoneId: -1 },
      { ...point, zoneId: 1.5 },
      { ...point, id: '' },
      { ...point, title: 3 },
      { ...point, extra: undefined, description: 'x'.repeat(2001) },
    ]) {
      assert.equal(isHostMessage({ ...init, points: [bad] }), false)
    }
  })

  it('caps the number of points', () => {
    const many = Array.from({ length: MAX_POINTS + 1 }, (_, i) => ({ ...point, id: `b${i}` }))
    assert.equal(isHostMessage({ ...init, points: many }), false)
  })

  it('rejects an unknown locale and bad states payloads', () => {
    assert.equal(isHostMessage({ type: 'rumbos:locale', v: 1, locale: 'fr' }), false)
    assert.equal(isHostMessage({ type: 'rumbos:states', v: 1, states: { b1: 'x' } }), false)
    assert.equal(isHostMessage({ type: 'rumbos:states', v: 1, states: [] }), false)
  })
})

describe('isCssVars', () => {
  it('only allows our namespace and harmless values', () => {
    assert.ok(
      isCssVars({ '--r3d-accent': 'rgb(1, 2, 3)', '--r3d-font-sans': "'Figtree', sans-serif" })
    )
    assert.equal(isCssVars({ '--color-ink': '#000' }), false)
    assert.equal(isCssVars({ '--r3d-bg': 'url(https://evil.example/x.png)' }), false)
    assert.equal(isCssVars({ '--r3d-bg': 'red; background: blue' }), false)
    assert.equal(isCssVars({ '--r3d-bg': 5 }), false)
  })
})

describe('isPageMessage', () => {
  it('accepts the four page messages', () => {
    assert.ok(isPageMessage({ type: 'rumbos:ready', v: 1 }))
    assert.ok(isPageMessage({ type: 'rumbos:pin-click', v: 1, pointId: 'b1' }))
    assert.ok(isPageMessage({ type: 'rumbos:open-activity', v: 1, pointId: 'b1' }))
    assert.ok(isPageMessage({ type: 'rumbos:error', v: 1, code: 'webgl', message: 'Sin WebGL' }))
  })

  it('rejects malformed ones', () => {
    assert.equal(isPageMessage({ type: 'rumbos:pin-click', v: 1 }), false)
    assert.equal(isPageMessage({ type: 'rumbos:pin-click', v: 1, pointId: 7 }), false)
    assert.equal(isPageMessage({ type: 'rumbos:ready', v: 0 }), false)
    assert.equal(isPageMessage({ type: 'omelette:notify-3d-export', v: 1 }), false)
  })
})
