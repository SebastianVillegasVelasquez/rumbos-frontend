import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { replaceEqualDeep } from '@tanstack/react-query'
import { serializeAppearance } from '../../welcome/welcomeWire.ts'
import { canonicalJson, sameJson, sha256Hex } from './canonicalJson.ts'
import type { MapSettings } from './types.ts'

describe('sameJson', () => {
  // The path that left the editor "unsaved" after Guardar: the body sent has its keys moved,
  // and the query cache keeps its old object when only the order differs.
  it('a saved copy with its keys in another order is no change from what the cache kept', () => {
    const draft = { trainer: { enabled: true }, mode: 'explorative' } as unknown as MapSettings
    const saved = serializeAppearance({
      settings: draft,
      defaultSkinId: null,
      skinRules: [],
    }).settings
    const cached = replaceEqualDeep(draft, saved)
    assert.notEqual(JSON.stringify(saved), JSON.stringify(cached))
    assert.equal(sameJson(saved, cached), true)
  })

  it('still sees a changed value', () => {
    assert.equal(sameJson({ a: 1, b: 2 }, { b: 3, a: 1 }), false)
  })
})

describe('canonicalJson', () => {
  it('ignores object key order at every depth', () => {
    const a = { b: 1, a: { d: [1, { y: 1, x: 2 }], c: null } }
    const b = { a: { c: null, d: [1, { x: 2, y: 1 }] }, b: 1 }
    assert.equal(canonicalJson(a), canonicalJson(b))
  })

  it('keeps array order significant', () => {
    assert.notEqual(canonicalJson([1, 2]), canonicalJson([2, 1]))
  })

  it('drops undefined object fields like JSON.stringify', () => {
    assert.equal(canonicalJson({ a: 1, b: undefined }), '{"a":1}')
  })

  it('hashes equal content equally and different content differently', async () => {
    const first = await sha256Hex(canonicalJson({ x: 0.5, y: 0.25 }))
    assert.equal(first, await sha256Hex(canonicalJson({ y: 0.25, x: 0.5 })))
    assert.notEqual(first, await sha256Hex(canonicalJson({ x: 0.5, y: 0.26 })))
    assert.match(first, /^[0-9a-f]{64}$/)
  })
})
