import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { QuizResult } from '../../embed/protocol.ts'
import { classifyQuiz, confirmsCompletion, outcomeOfResult } from './quizOutcome.ts'

const result = (patch: Partial<QuizResult> = {}): QuizResult => ({
  attempts: 0,
  finishedAttempts: 0,
  inProgress: false,
  percent: null,
  pendingGrading: false,
  passedThreshold: null,
  ...patch,
})

describe('a result with a reason (plugin v5.9)', () => {
  it('maps every reason to one kind', () => {
    const kinds = {
      ok: 'finished',
      no_attempts: 'none',
      in_progress: 'in_progress',
      preview_only: 'non_student',
      cannot_attempt: 'non_student',
      not_graded_yet: 'not_graded',
    } as const
    for (const [reason, kind] of Object.entries(kinds))
      assert.equal(classifyQuiz(result({ reason: reason as keyof typeof kinds })), kind, reason)
  })

  it('trusts the reason over the counts', () => {
    // A teacher with a preview attempt: finished 0, and the plugin says why.
    const preview = result({ previewAttempts: 1, canAttempt: false, reason: 'preview_only' })
    assert.deepEqual(outcomeOfResult(preview), { satisfied: true, method: 'fallback' })
    assert.deepEqual(outcomeOfResult(result({ reason: 'cannot_attempt', canAttempt: false })), {
      satisfied: true,
      method: 'fallback',
    })
    assert.deepEqual(outcomeOfResult(result({ reason: 'ok', finishedAttempts: 1, attempts: 1 })), {
      satisfied: true,
      method: 'completed',
    })
  })

  it('keeps a student with nothing sent, or an open attempt, waiting', () => {
    assert.equal(outcomeOfResult(result({ reason: 'no_attempts' })).satisfied, false)
    assert.equal(
      outcomeOfResult(result({ reason: 'in_progress', inProgress: true, attempts: 1 })).satisfied,
      false
    )
  })

  it('records not graded yet as completed only with a finished attempt behind it', () => {
    const handedIn = result({
      reason: 'not_graded_yet',
      attempts: 1,
      finishedAttempts: 1,
      pendingGrading: true,
    })
    assert.deepEqual(outcomeOfResult(handedIn), { satisfied: true, method: 'completed' })
    const none = result({ reason: 'not_graded_yet', pendingGrading: true })
    assert.deepEqual(outcomeOfResult(none), { satisfied: true, method: 'fallback' })
  })
})

describe('a result without a reason (an older plugin)', () => {
  it('finishes on a finished attempt, as before', () => {
    const done = result({ attempts: 1, finishedAttempts: 1 })
    assert.equal(classifyQuiz(done), 'finished')
    assert.equal(confirmsCompletion(done), true)
  })

  it('waits on an open attempt', () => {
    const open = result({ attempts: 1, inProgress: true })
    assert.equal(classifyQuiz(open), 'in_progress')
    assert.equal(confirmsCompletion(open), false)
  })

  it('treats nothing at all as unknown, not as a student who has not started', () => {
    assert.equal(classifyQuiz(result()), 'unknown')
    assert.equal(confirmsCompletion(result()), false)
  })

  it('lets a role that cannot attempt go on even with no reason', () => {
    assert.deepEqual(outcomeOfResult(result({ canAttempt: false, previewAttempts: 1 })), {
      satisfied: true,
      method: 'fallback',
    })
  })

  it('does not release a student on previewAttempts alone', () => {
    assert.equal(confirmsCompletion(result({ previewAttempts: 2 })), false)
  })
})
