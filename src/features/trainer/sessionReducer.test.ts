import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  initialSession,
  isAnswerable,
  placePair,
  placeToken,
  removePair,
  removeToken,
  setGap,
  sessionReducer,
  type SessionEvent,
  type SessionState,
} from './sessionReducer.ts'
import type { AnswerResult, SessionStart, Step } from './types.ts'

const mcq: Step = {
  step_id: 's1',
  type: 'mcq',
  prompt: 'Pick',
  hint: null,
  audio: null,
  options: [
    { option_id: 'a', text: 'A' },
    { option_id: 'b', text: 'B' },
  ],
}
const second: Step = { ...mcq, step_id: 's2' }
const start: SessionStart = {
  session_id: 'sess',
  preview: false,
  step: mcq,
  progress: { index: 1, total: 2 },
}
const result = (next: Step | null): AnswerResult => ({
  outcome: 'correct',
  feedback: { explanation: 'Because.', closest_answer: null, error_tags: [] },
  next_step: next,
  progress: { index: next ? 2 : 2, total: 2 },
})

const run = (events: SessionEvent[], from: SessionState = initialSession) =>
  events.reduce(sessionReducer, from)

describe('practice session reducer', () => {
  it('starts, shows the first step and keeps the preview flag', () => {
    const s = run([{ type: 'start' }, { type: 'started', start: { ...start, preview: true } }])
    assert.equal(s.phase, 'step')
    assert.equal(s.preview, true)
    assert.equal(s.step?.step_id, 's1')
  })

  it('does not send an empty answer', () => {
    const s = run([
      { type: 'start' },
      { type: 'started', start },
      { type: 'submit', attemptId: 'x' },
    ])
    assert.equal(s.phase, 'step')
    assert.equal(s.attemptId, null)
  })

  it('a double submit while checking changes nothing', () => {
    const s = run([
      { type: 'start' },
      { type: 'started', start },
      { type: 'draft', response: { option_id: 'a' } },
      { type: 'submit', attemptId: 'one' },
      { type: 'submit', attemptId: 'two' },
    ])
    assert.equal(s.phase, 'checking')
    assert.equal(s.attemptId, 'one')
  })

  it('walks answer, feedback, next, and finishes after the last step', () => {
    let s = run([
      { type: 'start' },
      { type: 'started', start },
      { type: 'draft', response: { option_id: 'a' } },
      { type: 'submit', attemptId: 'one' },
      { type: 'answered', result: result(second) },
    ])
    assert.equal(s.phase, 'feedback')
    // No finish while there is a next step.
    assert.equal(sessionReducer(s, { type: 'finish' }).phase, 'feedback')
    s = sessionReducer(s, { type: 'next' })
    assert.equal(s.phase, 'step')
    assert.equal(s.step?.step_id, 's2')
    assert.equal(s.draft, null)
    s = run(
      [
        { type: 'draft', response: { option_id: 'b' } },
        { type: 'submit', attemptId: 'two' },
        { type: 'answered', result: result(null) },
        { type: 'finish' },
      ],
      s
    )
    assert.equal(s.phase, 'finishing')
    s = sessionReducer(s, {
      type: 'finished',
      summary: {
        score: { correct: 2, total: 2 },
        went_well: [],
        to_improve: [],
        new_vocabulary: [],
        can_do: [],
        next_activity_id: null,
      },
    })
    assert.equal(s.phase, 'summary')
  })

  it('a failed answer keeps the draft and the same attempt id on retry', () => {
    let s = run([
      { type: 'start' },
      { type: 'started', start },
      { type: 'draft', response: { option_id: 'a' } },
      { type: 'submit', attemptId: 'one' },
      { type: 'failed', kind: 'unreachable' },
    ])
    assert.equal(s.phase, 'error')
    assert.equal(s.failedAt, 'answer')
    assert.deepEqual(s.draft, { option_id: 'a' })
    s = sessionReducer(s, { type: 'retry' })
    assert.equal(s.phase, 'checking')
    assert.equal(s.attemptId, 'one')
    assert.deepEqual(s.draft, { option_id: 'a' })
  })

  it('a failed start retries from scratch; a failed finish retries the finish', () => {
    const a = run([{ type: 'start' }, { type: 'failed', kind: 'unreachable' }, { type: 'retry' }])
    assert.equal(a.phase, 'starting')
    const b = run([
      { type: 'start' },
      { type: 'started', start },
      { type: 'draft', response: { option_id: 'a' } },
      { type: 'submit', attemptId: 'one' },
      { type: 'answered', result: result(null) },
      { type: 'finish' },
      { type: 'failed', kind: 'other' },
      { type: 'retry' },
    ])
    assert.equal(b.phase, 'finishing')
  })

  it('answered out of order is ignored', () => {
    assert.equal(
      sessionReducer(initialSession, { type: 'answered', result: result(null) }).phase,
      'idle'
    )
  })
})

describe('is the step answerable', () => {
  it('mcq needs an option', () => {
    assert.equal(isAnswerable(mcq, null), false)
    assert.equal(isAnswerable(mcq, { option_id: 'a' }), true)
  })
  it('gap_fill needs every gap', () => {
    const step: Step = {
      step_id: 'g',
      type: 'gap_fill',
      prompt: '',
      hint: null,
      audio: null,
      template: 'I {1} a {2}.',
      gaps: [
        { gap_id: '1', options: null },
        { gap_id: '2', options: null },
      ],
    }
    assert.equal(isAnswerable(step, setGap(null, '1', 'am')), false)
    assert.equal(isAnswerable(step, setGap(setGap(null, '1', 'am'), '2', '  ')), false)
    assert.equal(isAnswerable(step, setGap(setGap(null, '1', 'am'), '2', 'student')), true)
  })
  it('dialogue accepts a choice or typed text', () => {
    const step: Step = {
      step_id: 'd',
      type: 'dialogue_turn',
      prompt: '',
      hint: null,
      audio: null,
      partner_line: { text: 'Hello', translation: null, audio: null },
      mode: 'type',
      options: null,
      starters: [],
      word_bank: [],
    }
    assert.equal(isAnswerable(step, { text: '   ' }), false)
    assert.equal(isAnswerable(step, { text: 'Hi' }), true)
    assert.equal(isAnswerable(step, { option_id: 'o' }), true)
  })
})

describe('reorder and match without dragging', () => {
  const reorder: Step = {
    step_id: 'r',
    type: 'reorder',
    prompt: '',
    hint: null,
    audio: null,
    tokens: [
      { token_id: 'a', text: 'I' },
      { token_id: 'b', text: 'am' },
    ],
  }
  const match: Step = {
    step_id: 'm',
    type: 'match',
    prompt: '',
    hint: null,
    audio: null,
    left: [
      { id: 'l1', text: 'one' },
      { id: 'l2', text: 'two' },
    ],
    right: [
      { id: 'r1', text: 'uno' },
      { id: 'r2', text: 'dos' },
    ],
  }
  it('tap places in order, tap again takes back, and it is complete when all are placed', () => {
    let d = placeToken(null, 'b')
    d = placeToken(d, 'a')
    assert.deepEqual(d, { token_ids: ['b', 'a'] })
    assert.equal(isAnswerable(reorder, d), true)
    d = removeToken(d, 'b')
    assert.deepEqual(d, { token_ids: ['a'] })
    assert.equal(isAnswerable(reorder, d), false)
    // Placing twice does not duplicate.
    assert.deepEqual(placeToken(d, 'a'), { token_ids: ['a'] })
  })
  it('a pair replaces an earlier one on either side; removing frees both', () => {
    let d = placePair(null, 'l1', 'r1')
    d = placePair(d, 'l2', 'r1')
    assert.deepEqual(d, { pairs: [['l2', 'r1']] })
    d = placePair(d, 'l1', 'r2')
    assert.equal(isAnswerable(match, d), true)
    d = removePair(d, 'l1')
    assert.equal(isAnswerable(match, d), false)
  })
})
