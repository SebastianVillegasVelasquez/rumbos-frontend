import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Match } from './matching.ts'
import { initReview, isDoubtful, reviewReducer, summarize } from './reviewState.ts'

const matches: Match[] = [
  { key: 'a', cmid: 10, confidence: 'exact', tier: 1 },
  { key: 'b', cmid: 11, confidence: 'similar', tier: 3 },
  { key: 'c', cmid: null, confidence: 'none', tier: null },
]

describe('review state', () => {
  it('starts from the proposals', () => {
    const state = initReview(matches)
    assert.deepEqual(state.mapping, { a: 10, b: 11, c: null })
    assert.deepEqual(summarize(state, true), {
      matched: 1,
      doubtful: 1,
      omitted: 1,
      duplicated: new Set(),
      canApply: true,
    })
  })

  it('blocks applying while two rows share a target, and frees it again', () => {
    let state = initReview(matches)
    state = reviewReducer(state, { type: 'choose', key: 'c', cmid: 10 })
    const blocked = summarize(state, true)
    assert.deepEqual([...blocked.duplicated], [10])
    assert.equal(blocked.canApply, false)
    state = reviewReducer(state, { type: 'choose', key: 'c', cmid: null })
    assert.equal(summarize(state, true).canApply, true)
  })

  it('needs the audio rights declaration when the archive has own audio', () => {
    assert.equal(summarize(initReview(matches), false).canApply, false)
  })

  it('counts a row the editor chose or confirmed as matched', () => {
    let state = initReview(matches)
    state = reviewReducer(state, { type: 'confirm', key: 'b' })
    assert.equal(summarize(state, true).doubtful, 0)
    assert.equal(summarize(state, true).matched, 2)
  })

  it('accepting the exact matches restores them and leaves the rest alone', () => {
    let state = initReview(matches)
    state = reviewReducer(state, { type: 'choose', key: 'a', cmid: null })
    state = reviewReducer(state, { type: 'choose', key: 'b', cmid: 12 })
    state = reviewReducer(state, { type: 'acceptExact' })
    assert.deepEqual(state.mapping, { a: 10, b: 12, c: null })
    assert.ok(state.reviewed.has('a'))
  })

  it('a refused target is removed from its row, highlighted and cannot be chosen again', () => {
    let state = initReview(matches)
    state = reviewReducer(state, { type: 'refused', cmid: 11 })
    assert.equal(state.mapping.b, null)
    assert.equal(state.highlightKey, 'b')
    const again = reviewReducer(state, { type: 'choose', key: 'c', cmid: 11 })
    assert.equal(again.mapping.c, null)
    assert.equal(isDoubtful(state, 'b', new Set()), true)
    state = reviewReducer(state, { type: 'choose', key: 'b', cmid: 12 })
    assert.equal(state.highlightKey, null)
  })

  it('a refused target is not brought back by accepting the exact matches', () => {
    let state = initReview(matches)
    state = reviewReducer(state, { type: 'refused', cmid: 10 })
    state = reviewReducer(state, { type: 'acceptExact' })
    assert.equal(state.mapping.a, null)
  })

  it('knows which rows to filter to', () => {
    const state = initReview(matches)
    const none = new Set<number>()
    assert.equal(isDoubtful(state, 'a', none), false)
    assert.equal(isDoubtful(state, 'b', none), true)
    assert.equal(isDoubtful(state, 'c', none), false)
    assert.equal(isDoubtful(state, 'a', new Set([10])), true)
  })
})
