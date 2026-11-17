import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { dueWords, reviewReducer, startReview, type ReviewEvent } from './reviewReducer.ts'
import type { SavedWord } from './types.ts'

const card = (id: string): SavedWord => ({
  word_id: id,
  word: id,
  translation: `${id}-es`,
  box: 1,
  due_at: '2026-01-01T00:00:00Z',
})
const run = (events: ReviewEvent[], from = startReview([card('a'), card('b')])) =>
  events.reduce(reviewReducer, from)

describe('vocabulary review', () => {
  it('with nothing due it is done at once', () => {
    assert.equal(startReview([]).phase, 'done')
  })

  it('cannot answer before the translation is shown', () => {
    const s = run([{ type: 'answer', knew: true, attemptId: 'x' }])
    assert.equal(s.phase, 'card')
    assert.equal(s.pending, null)
  })

  it('walks the cards, counting the ones that were known', () => {
    const s = run([
      { type: 'reveal' },
      { type: 'answer', knew: true, attemptId: '1' },
      { type: 'saved' },
      { type: 'reveal' },
      { type: 'answer', knew: false, attemptId: '2' },
      { type: 'saved' },
    ])
    assert.equal(s.phase, 'done')
    assert.equal(s.knew, 1)
    assert.equal(s.index, 2)
  })

  it('a failed save stays on the card and the retry keeps the same attempt id', () => {
    let s = run([
      { type: 'reveal' },
      { type: 'answer', knew: true, attemptId: 'one' },
      { type: 'failed' },
    ])
    assert.equal(s.phase, 'error')
    assert.equal(s.index, 0)
    s = reviewReducer(s, { type: 'retry' })
    assert.equal(s.phase, 'sending')
    assert.equal(s.pending?.attemptId, 'one')
  })

  it('a second answer while sending is ignored', () => {
    const s = run([
      { type: 'reveal' },
      { type: 'answer', knew: true, attemptId: 'one' },
      { type: 'answer', knew: false, attemptId: 'two' },
    ])
    assert.equal(s.pending?.attemptId, 'one')
  })
  it('only the words whose time has come are due', () => {
    const late = { ...card('late'), due_at: '2026-01-01T00:00:00Z' }
    const soon = { ...card('soon'), due_at: '2099-01-01T00:00:00Z' }
    assert.deepEqual(
      dueWords([late, soon], Date.parse('2026-06-01T00:00:00Z')).map((w) => w.word_id),
      ['late']
    )
  })
})
