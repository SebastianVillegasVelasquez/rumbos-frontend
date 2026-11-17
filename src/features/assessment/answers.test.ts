import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  clipAt,
  countWords,
  itemStatus,
  numberItems,
  pairUp,
  placeOf,
  splitTemplate,
  templateWordCount,
  unanswered,
  unpair,
  wordLimit,
} from './answers.ts'
import type { AssessmentItem, SectionPayload } from './types.ts'

const mcq: AssessmentItem = {
  item_id: 'q1',
  type: 'mcq',
  prompt: 'p',
  options: [{ option_id: 'a', text: 'A' }],
}
const match: AssessmentItem = {
  item_id: 'm1',
  type: 'match_audio',
  prompt: 'p',
  clips: [1, 2].map((n) => ({ id: `c${n}`, audio: { url: 'u', duration_s: 1 } })),
  places: [{ id: 'p1', text: 'a' }],
}
const tmpl: AssessmentItem = {
  item_id: 't1',
  type: 'template_text',
  prompt: 'p',
  template: 'Hello {name}, I am {age} years old.',
  min_words: 8,
  max_words: 10,
}

describe('words', () => {
  it('counts words as a reader does', () => {
    assert.equal(countWords(''), 0)
    assert.equal(countWords('  one   two '), 2)
    assert.equal(countWords("don't check-in - now"), 3)
    assert.equal(countWords('año nuevo'), 2)
  })
  it('compares against the limits', () => {
    assert.equal(wordLimit(4, 5, 8), 'below')
    assert.equal(wordLimit(5, 5, 8), 'within')
    assert.equal(wordLimit(8, 5, 8), 'within')
    assert.equal(wordLimit(9, 5, 8), 'above')
  })
  it('counts the template text and the blanks together', () => {
    assert.deepEqual(
      splitTemplate('Hi {a}!').map((p) => p.kind),
      ['text', 'blank', 'text']
    )
    assert.equal(
      templateWordCount(tmpl.type === 'template_text' ? tmpl.template : '', undefined),
      5
    )
    assert.equal(
      templateWordCount('Hello {name}, I am {age} years old.', {
        values: { name: 'Ana', age: '20' },
      }),
      7
    )
  })
})

describe('item status', () => {
  it('knows an unanswered, a partial and a complete item', () => {
    assert.equal(itemStatus(mcq, undefined), 'empty')
    assert.equal(itemStatus(mcq, { option_id: 'a' }), 'done')
    assert.equal(itemStatus(match, { pairs: [['c1', 'p1']] }), 'partial')
    assert.equal(
      itemStatus(match, {
        pairs: [
          ['c1', 'p1'],
          ['c2', 'p2'],
        ],
      }),
      'done'
    )
    assert.equal(itemStatus(tmpl, { values: { name: 'Ana' } }), 'partial')
    // Filled but under the minimum: still partial, so the review flags it.
    assert.equal(itemStatus(tmpl, { values: { name: 'A', age: '2' } }), 'partial')
    assert.equal(itemStatus(tmpl, { values: { name: 'Ana Maria', age: 'twenty' } }), 'done')
  })
})

describe('matching without drag and drop', () => {
  it('one clip, one place; pairing over a link releases the other end', () => {
    let pairs = pairUp([], 'c1', 'p1')
    pairs = pairUp(pairs, 'c2', 'p1')
    assert.deepEqual(pairs, [['c2', 'p1']])
    assert.equal(clipAt(pairs, 'p1'), 'c2')
    pairs = pairUp(pairs, 'c2', 'p2')
    assert.equal(placeOf(pairs, 'c2'), 'p2')
    assert.deepEqual(unpair(pairs, 'c2'), [])
  })
})

describe('numbering', () => {
  const section = (key: string, items: AssessmentItem[]): SectionPayload => ({
    key,
    title: key,
    deadline_at: '',
    server_now: '',
    parts: [{ part_key: 'a', instructions: '', shared: null, items }],
    saved: {},
  })
  it('numbers across sections by the server counts, and lists the unanswered', () => {
    // Listening holds 1 item here, so reading starts at 2; the matching task spans two.
    const numbered = numberItems(
      [section('listening', [mcq]), null, section('use', [match])],
      [1, 4, 2]
    )
    assert.deepEqual(
      numbered.map((n) => [n.number, n.last, n.item.item_id]),
      [
        [1, 1, 'q1'],
        [6, 7, 'm1'],
      ]
    )
    assert.deepEqual(
      unanswered(numbered, { q1: { option_id: 'a' } }).map((n) => n.number),
      [6]
    )
  })
})
