import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { AssessmentLeakError, findLeak, refuseLeak } from './leakGuard.ts'

describe('leak guard', () => {
  it('accepts a normal section payload', () => {
    const clean = {
      key: 'reading',
      parts: [
        { items: [{ item_id: 'a', type: 'mcq', options: [{ option_id: 'o1', text: 'x' }] }] },
      ],
      saved: { a: { option_id: 'o1' } },
    }
    assert.equal(findLeak(clean), null)
    assert.equal(refuseLeak(clean), clean)
  })
  it('finds keys, correctness and rubrics anywhere', () => {
    for (const bad of [
      { correct: true },
      { is_correct: false },
      { items: [{ correct_option_id: 'o1' }] },
      { answer_key: {} },
      { by_section: [{ rubric: 'x' }] },
      { accepted_answers: ['a'] },
      { explanation: 'x' },
      { a: { b: { solution: 1 } } },
    ])
      assert.notEqual(findLeak(bad), null, JSON.stringify(bad))
  })
  it('refuses a leaking response whole', () => {
    assert.throws(() => refuseLeak({ items: [{ correct: 1 }] }), AssessmentLeakError)
  })
  it('does not confuse harmless words', () => {
    assert.equal(findLeak({ keyboard: 1, incorrect_label: 'x', monkey: 1 }), null)
  })
})
