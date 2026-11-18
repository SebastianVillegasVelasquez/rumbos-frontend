import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ContractError } from '../course-map/data/contract.ts'
import { practiceExamples } from './fixtures/practiceExamples.ts'
import { readAnswer, readSession, readSummary } from './sessionWire.ts'

// The backend's own examples (fixtures/practiceExamples) read the way the screens need.

const EP = 'POST /trainer/sessions'

describe('opening an exercise', () => {
  const { start, cursor } = readSession(practiceExamples().exerciseSession, EP)

  it('starts at the first step, with the options in the screens shape', () => {
    assert.equal(start.session_id, '9b2e7c10-5d4f-4e8a-a6b3-1c0f8d2e4a01')
    assert.equal(start.step.step_id, 't.mcq')
    assert.deepEqual(start.progress, { index: 1, total: 5 })
    assert.equal(start.step.type, 'mcq')
    if (start.step.type === 'mcq')
      assert.deepEqual(start.step.options[0], { option_id: 'c', text: 'am' })
  })

  it('reads every kind of step the example has', () => {
    assert.deepEqual(
      cursor.steps.map((step) => step.type),
      ['mcq', 'gap_fill', 'reorder', 'match', 'short_answer']
    )
    const reorder = cursor.steps[2]
    if (reorder?.type === 'reorder')
      assert.deepEqual(reorder.tokens[0], { token_id: 't2', text: 'are' })
    const match = cursor.steps[3]
    if (match?.type === 'match') assert.deepEqual(match.right[0], { id: 'r2', text: 'Goodbye' })
    const gap = cursor.steps[1]
    if (gap?.type === 'gap_fill') assert.deepEqual(gap.gaps, [{ gap_id: 'g1', options: null }])
  })

  it('resumes at the first step without an answer', () => {
    const view = practiceExamples().exerciseSession
    view.steps[0]!.answered = true
    view.steps[1]!.answered = true
    const resumed = readSession(view, EP)
    assert.equal(resumed.start.step.step_id, 't.reorder')
    assert.deepEqual(resumed.start.progress, { index: 3, total: 5 })
  })
})

describe('answering an exercise', () => {
  it('moves on to the next step of the session, with the wrong answer explained', () => {
    const { cursor } = readSession(practiceExamples().exerciseSession, EP)
    const result = readAnswer(practiceExamples().wrongAnswer, cursor, 't.mcq', 'POST answers')
    assert.equal(result.outcome, 'incorrect')
    assert.equal(result.feedback.closest_answer, 'are')
    assert.deepEqual(result.feedback.error_tags, [
      { tag: 'Use are with you.', text: 'Use are with you.' },
    ])
    assert.equal(result.next_step?.step_id, 't.gap')
    assert.deepEqual(result.progress, { index: 1, total: 5 })
  })

  it('has no next step after the last one', () => {
    const { cursor } = readSession(practiceExamples().exerciseSession, EP)
    const result = readAnswer(practiceExamples().rightAnswer, cursor, 't.short', 'POST answers')
    assert.equal(result.next_step, null)
    assert.deepEqual(result.progress, { index: 5, total: 5 })
  })
})

describe('a dialogue', () => {
  it('opens on one turn, with the partner line as the screens read it', () => {
    const { start } = readSession(practiceExamples().dialogueSession, EP)
    assert.deepEqual(start.progress, { index: 1, total: 2 })
    assert.equal(start.step.type, 'dialogue_turn')
    if (start.step.type === 'dialogue_turn') {
      assert.equal(start.step.partner_line.text, 'Hello!')
      assert.equal(start.step.mode, 'choose')
      assert.deepEqual(start.step.options?.[0], { option_id: 'o1', text: 'Hi' })
    }
  })

  it('takes the next turn from the answer, and an empty list of options as none', () => {
    const { cursor } = readSession(practiceExamples().dialogueSession, EP)
    const result = readAnswer(practiceExamples().dialogueAccepted, cursor, 'n1', 'POST answers')
    assert.equal(result.outcome, 'accepted')
    assert.equal(result.next_step?.step_id, 'n2')
    if (result.next_step?.type === 'dialogue_turn') {
      assert.equal(result.next_step.mode, 'type')
      assert.equal(result.next_step.options, null)
    }
  })
})

describe('finishing', () => {
  it('reads the first-try score and what to revise', () => {
    const summary = readSummary(practiceExamples().finish, 'POST finish')
    assert.deepEqual(summary.score, { correct: 1, total: 5 })
    assert.deepEqual(summary.to_improve, [
      { tag: 'be_agreement', text: 'be_agreement', example: null },
    ])
    assert.equal(summary.next_activity_id, null)
  })
})

describe('a body the screens cannot read', () => {
  it('is a contract error naming the endpoint and the fields', () => {
    const view = practiceExamples().exerciseSession as unknown as Record<string, unknown>
    delete view.title
    view.steps = [{ step_id: 'x', type: 'poem' }]
    try {
      readSession(view, EP)
      assert.fail('expected a ContractError')
    } catch (error) {
      assert.ok(error instanceof ContractError)
      assert.equal(error.endpoint, EP)
      assert.deepEqual(error.issues, [
        'title: expected a string, got undefined',
        'steps[0].type: expected one of mcq, listen_choose, gap_fill, reorder, match, short_answer, dialogue_turn, got poem',
      ])
    }
  })

  it('refuses an exercise answer that carries a next step', () => {
    const { cursor } = readSession(practiceExamples().exerciseSession, EP)
    const answer = { ...practiceExamples().rightAnswer, next: { step_id: 'x' } }
    assert.throws(() => readAnswer(answer, cursor, 't.mcq', 'POST answers'), ContractError)
  })
})
