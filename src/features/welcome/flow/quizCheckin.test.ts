import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { QuizResult } from '../../embed/protocol.ts'
import {
  CHECK_COUNT_GAP_MS,
  CHECK_TIMEOUT_MS,
  ESCAPE_AFTER_OPEN_MS,
  checkinReducer,
  checkTimeoutIn,
  createCheckin,
  escapeDueAt,
  escapeVisible,
  isChecking,
  type CheckinEvent,
} from './quizCheckin.ts'

const none: QuizResult = {
  attempts: 0,
  finishedAttempts: 0,
  inProgress: false,
  percent: null,
  pendingGrading: false,
  passedThreshold: null,
}
const done: QuizResult = { ...none, attempts: 1, finishedAttempts: 1, percent: 80 }

// A fake clock: every event carries the time it happened at.
const T0 = 1_000_000
const run = (...events: CheckinEvent[]) => events.reduce(checkinReducer, createCheckin(T0))
const at = (ms: number) => T0 + ms
// One check: sent, then answered 200 ms later.
const check = (sentAt: number, result: QuizResult): CheckinEvent[] => [
  { type: 'check-start', at: at(sentAt) },
  { type: 'answer', at: at(sentAt + 200), result },
]

describe('the check button feedback', () => {
  it('is pending from the request until the answer, then says what it found', () => {
    let state = run({ type: 'check-start', at: at(0) })
    assert.equal(isChecking(state), true)
    state = checkinReducer(state, { type: 'answer', at: at(300), result: none })
    assert.equal(isChecking(state), false)
    assert.deepEqual(state.last, {
      at: at(300),
      outcome: { kind: 'result', checkedKind: 'unknown', finishedAttempts: 0, previewAttempts: 0 },
    })
  })

  it('records an answer that changed nothing, so the screen still moves', () => {
    const state = run(...check(0, none), ...check(10_000, none))
    assert.equal(state.last?.at, at(10_200))
  })

  it('treats a second trigger while one is out as the same check', () => {
    const state = run({ type: 'check-start', at: at(0) }, { type: 'check-start', at: at(2_000) })
    assert.equal(state.pendingSince, at(0))
    assert.equal(checkTimeoutIn(state), CHECK_TIMEOUT_MS - 2_000)
  })

  it('times out after 5 s, says so, and is enabled again', () => {
    let state = run({ type: 'check-start', at: at(0) })
    assert.equal(checkTimeoutIn(checkinReducer(state, { type: 'tick', at: at(5_000) })), 0)
    state = checkinReducer(state, { type: 'timeout', at: at(5_000) })
    assert.equal(isChecking(state), false)
    assert.deepEqual(state.last?.outcome, { kind: 'timeout' })
    assert.equal(escapeVisible(state), true)
  })

  it('ignores a timer that fires after the answer came', () => {
    const answered = run(...check(0, none))
    assert.equal(checkinReducer(answered, { type: 'timeout', at: at(5_000) }).trouble, false)
  })

  it('a late answer after a timeout still shows and clears the trouble', () => {
    let state = run(
      { type: 'check-start', at: at(0) },
      { type: 'timeout', at: at(5_000) },
      { type: 'check-start', at: at(6_000) }
    )
    state = checkinReducer(state, { type: 'answer', at: at(6_300), result: done })
    assert.equal(state.trouble, false)
    assert.equal(escapeVisible(state), false)
  })
})

describe('the recorded escape: not before a fair chance', () => {
  it('is hidden before the quiz was opened, however many checks fail', () => {
    const state = run(...check(0, none), ...check(10_000, none), ...check(20_000, none))
    assert.equal(escapeVisible(state), false)
    assert.equal(state.streak, 0)
  })

  it('is hidden after opening with one failed check', () => {
    const state = run({ type: 'opened', at: at(1_000) }, ...check(5_000, none))
    assert.equal(state.streak, 1)
    assert.equal(escapeVisible(state), false)
  })

  it('shows after opening and two checks in a row that did not confirm', () => {
    const state = run(
      { type: 'opened', at: at(1_000) },
      ...check(5_000, none),
      ...check(5_000 + CHECK_COUNT_GAP_MS, none)
    )
    assert.equal(state.streak, 2)
    assert.equal(escapeVisible(state), true)
  })

  it('does not count the burst that follows an overlay closing as two checks', () => {
    // overlay-closed and the state refresh ask 1.2 s apart: one look at Moodle.
    const state = run(
      { type: 'opened', at: at(1_000) },
      ...check(5_000, none),
      ...check(6_200, none)
    )
    assert.equal(state.streak, 1)
    assert.equal(escapeVisible(state), false)
  })

  it('a confirming answer resets the streak', () => {
    const state = run({ type: 'opened', at: at(0) }, ...check(5_000, none), ...check(10_000, done))
    assert.equal(state.streak, 0)
  })

  it('shows 45 s after the quiz was opened, never counting from the step opening', () => {
    let state = run({ type: 'tick', at: at(100_000) })
    assert.equal(escapeVisible(state), false)
    assert.equal(escapeDueAt(state), null)
    state = checkinReducer(state, { type: 'opened', at: at(100_000) })
    state = checkinReducer(state, { type: 'tick', at: at(100_000 + ESCAPE_AFTER_OPEN_MS - 1) })
    assert.equal(escapeVisible(state), false)
    assert.equal(escapeDueAt(state), at(100_000 + ESCAPE_AFTER_OPEN_MS))
    state = checkinReducer(state, { type: 'tick', at: at(100_000 + ESCAPE_AFTER_OPEN_MS) })
    assert.equal(escapeVisible(state), true)
  })

  it('keeps the first opening, so reopening does not postpone the exit', () => {
    const state = run({ type: 'opened', at: at(1_000) }, { type: 'opened', at: at(30_000) })
    assert.equal(state.openedAt, at(1_000))
  })

  it('the clock never goes back', () => {
    const state = run({ type: 'tick', at: at(9_000) }, { type: 'tick', at: at(2_000) })
    assert.equal(state.now, at(9_000))
  })
})

describe('the recorded escape: after an error or a missing reply', () => {
  it('shows at once on an error reply, even before the quiz was opened', () => {
    const state = run({ type: 'check-start', at: at(0) }, { type: 'error', at: at(300) })
    assert.equal(escapeVisible(state), true)
    assert.equal(isChecking(state), false)
    assert.deepEqual(state.last?.outcome, { kind: 'error' })
  })

  it('shows at once when nothing answered, before the quiz was opened', () => {
    const state = run({ type: 'check-start', at: at(0) }, { type: 'timeout', at: at(5_000) })
    assert.equal(escapeVisible(state), true)
  })
})
