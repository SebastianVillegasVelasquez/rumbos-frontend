import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  allSectionsLoaded,
  examReducer,
  hasUnsaved,
  initialExam,
  isFinished,
  screenKey,
  unansweredItems,
  type ExamEvent,
  type ExamState,
} from './examReducer.ts'
import type { AssessmentResult, AttemptStart, SectionPayload } from './types.ts'

const T0 = Date.parse('2026-11-17T10:00:00Z')
const at = (minutes: number) => T0 + minutes * 60_000

const attempt: AttemptStart = {
  attempt_id: 'att1',
  started_at: '2026-11-17T10:00:00Z',
  deadline_at: '2026-11-17T11:00:00Z',
  server_now: '2026-11-17T10:00:00Z',
  sections: [
    { key: 'listening', title: 'Listening', instructions: '', item_count: 2 },
    { key: 'reading', title: 'Reading', instructions: '', item_count: 1 },
  ],
}

const section = (
  key: string,
  ids: string[],
  saved: SectionPayload['saved'] = {}
): SectionPayload => ({
  key,
  title: key,
  deadline_at: attempt.deadline_at,
  server_now: '2026-11-17T10:00:00Z',
  parts: [
    {
      part_key: 'a',
      instructions: '',
      shared: null,
      items: ids.map((id) => ({
        item_id: id,
        type: 'mcq' as const,
        prompt: 'p',
        options: [{ option_id: 'o1', text: 'x' }],
      })),
    },
  ],
  saved,
})

const result = (status: 'submitted' | 'expired'): AssessmentResult => ({
  status,
  percent: '83.25',
  passed: true,
  band: 'achieved',
  by_section: [],
  by_module: [],
  attempts: { used: 1, max: 1 },
  gain: null,
  sync: { state: 'not_required' },
})

const run = (events: ExamEvent[], from: ExamState = initialExam) => events.reduce(examReducer, from)

const running = () =>
  run([
    { type: 'start', purpose: 'check_in', resume: false },
    { type: 'started', attempt, now: T0 },
    { type: 'section-loaded', index: 0, payload: section('listening', ['q1', 'q2']), now: T0 },
    { type: 'section-loaded', index: 1, payload: section('reading', ['q3']), now: T0 },
  ])

describe('starting', () => {
  it('goes idle, starting, running and takes the server clock', () => {
    const s = run([
      { type: 'start', purpose: 'check_in', resume: false },
      { type: 'started', attempt, now: at(5) },
    ])
    assert.equal(s.phase, 'running')
    assert.equal(s.attemptId, 'att1')
    // The device is 5 minutes ahead of the server: the clock corrects it.
    assert.equal(s.remainingMs, 60 * 60_000)
  })
  it('a second start while starting changes nothing', () => {
    const once = run([{ type: 'start', purpose: 'final', resume: false }])
    assert.equal(examReducer(once, { type: 'start', purpose: 'final', resume: false }), once)
  })
  it('resuming restores the saved answers and the remaining time', () => {
    const s = run([
      { type: 'start', purpose: 'check_in', resume: true },
      { type: 'started', attempt: { ...attempt, server_now: '2026-11-17T10:25:00Z' }, now: at(0) },
      {
        type: 'section-loaded',
        index: 0,
        payload: {
          ...section('listening', ['q1', 'q2'], { q1: { option_id: 'o1' } }),
          server_now: '2026-11-17T10:25:00Z',
        },
        now: at(0),
      },
    ])
    assert.equal(s.phase, 'running')
    assert.deepEqual(s.answers, { q1: { option_id: 'o1' } })
    assert.equal(s.remainingMs, 35 * 60_000)
  })
  it('a failed start shows an error that retries the start', () => {
    const failed = run([
      { type: 'start', purpose: 'check_in', resume: false },
      { type: 'failed', kind: 'unreachable', retry: 'start' },
    ])
    assert.equal(failed.phase, 'error')
    assert.equal(examReducer(failed, { type: 'retry', now: T0 }).phase, 'starting')
  })
})

describe('answers and saving', () => {
  it('keeps an answer dirty until the save is acknowledged', () => {
    let s = running()
    s = run([{ type: 'answer', itemId: 'q1', response: { option_id: 'o1' } }], s)
    assert.equal(hasUnsaved(s), true)
    s = run([{ type: 'save-start' }], s)
    assert.equal(s.phase, 'saving')
    // The student answers again while the save is out: still accepted.
    s = run([{ type: 'answer', itemId: 'q2', response: { option_id: 'o1' } }], s)
    s = run(
      [
        {
          type: 'save-ok',
          ack: {
            saved_at: '',
            server_now: '2026-11-17T10:01:00Z',
            deadline_at: attempt.deadline_at,
          },
          now: at(1),
        },
      ],
      s
    )
    assert.equal(s.phase, 'running')
    assert.deepEqual(Object.keys(s.dirty), ['q2'])
    assert.equal(s.saveStatus, 'idle')
  })
  it('a failed save loses nothing and can be retried', () => {
    let s = run(
      [
        { type: 'answer', itemId: 'q1', response: { values: { a: 'typed text' } } },
        { type: 'save-start' },
        { type: 'save-failed', kind: 'unreachable' },
      ],
      running()
    )
    assert.equal(s.phase, 'running')
    assert.equal(s.saveStatus, 'failed')
    assert.deepEqual(s.dirty.q1, { values: { a: 'typed text' } })
    s = run([{ type: 'save-start' }], s)
    assert.equal(s.phase, 'saving')
  })
  it('an edit made during a failed save wins over the older one', () => {
    const s = run(
      [
        { type: 'answer', itemId: 'q1', response: { option_id: 'old' } },
        { type: 'save-start' },
        { type: 'answer', itemId: 'q1', response: { option_id: 'new' } },
        { type: 'save-failed', kind: 'unreachable' },
      ],
      running()
    )
    assert.deepEqual(s.dirty.q1, { option_id: 'new' })
  })
  it('saving an answer does not change the screen, so focus is not moved to the title', () => {
    const before = running()
    let s = run([{ type: 'answer', itemId: 'q1', response: { option_id: 'o1' } }], before)
    s = examReducer(s, { type: 'save-start' })
    assert.equal(s.phase, 'saving')
    assert.equal(screenKey(s), screenKey(before))
    s = examReducer(s, {
      type: 'save-ok',
      ack: {
        saved_at: '',
        server_now: '2026-11-17T10:01:00Z',
        deadline_at: attempt.deadline_at,
      },
      now: at(1),
    })
    assert.equal(s.phase, 'running')
    assert.equal(screenKey(s), screenKey(before))
    // A real change of screen still does.
    assert.notEqual(screenKey({ ...s, view: 'review' }), screenKey(before))
    assert.notEqual(screenKey({ ...s, sectionIndex: 1 }), screenKey(before))
  })
  it('a save refused as closed goes to submit, keeping the answers', () => {
    const s = run(
      [
        { type: 'answer', itemId: 'q1', response: { option_id: 'o1' } },
        { type: 'save-start' },
        { type: 'save-failed', kind: 'closed' },
      ],
      running()
    )
    assert.equal(s.phase, 'submitting')
    assert.deepEqual(s.answers.q1, { option_id: 'o1' })
  })
  it('refuses answers once the exam is over', () => {
    const over = run(
      [{ type: 'submit' }, { type: 'submitted', result: result('submitted') }],
      running()
    )
    assert.equal(
      examReducer(over, { type: 'answer', itemId: 'q1', response: { option_id: 'o1' } }),
      over
    )
  })
  it('a section that arrives late does not overwrite a newer local answer', () => {
    const s = run([
      { type: 'start', purpose: 'check_in', resume: false },
      { type: 'started', attempt, now: T0 },
      { type: 'answer', itemId: 'q1', response: { option_id: 'local' } },
      {
        type: 'section-loaded',
        index: 0,
        payload: section('listening', ['q1', 'q2'], { q1: { option_id: 'server' } }),
        now: T0,
      },
    ])
    assert.deepEqual(s.answers.q1, { option_id: 'local' })
  })
})

describe('the timer', () => {
  it('announces 10, 5 and 1 minutes once each and not every second', () => {
    let s = running()
    const said: number[] = []
    for (let sec = 0; sec <= 60 * 60; sec++) {
      s = examReducer(s, { type: 'tick', now: T0 + sec * 1000 })
      if (s.announcement !== null) {
        said.push(s.announcement)
        s = examReducer(s, { type: 'announced' })
      }
      if (s.phase === 'submitting') break
    }
    assert.deepEqual(said, [10, 5, 1])
  })
  it('at zero it submits by itself', () => {
    let s = running()
    s = examReducer(s, { type: 'tick', now: at(59) })
    assert.equal(s.phase, 'running')
    s = examReducer(s, { type: 'tick', now: at(60) })
    assert.equal(s.phase, 'submitting')
    assert.equal(s.timeUp, true)
    // The server answers with an expired attempt.
    s = examReducer(s, { type: 'submitted', result: result('expired') })
    assert.equal(s.phase, 'expired')
    assert.equal(isFinished(s.phase), true)
  })
  it('a wrong device clock cannot extend the exam', () => {
    // The device clock is 3 hours behind; the server says 59 minutes in.
    const s = run([
      { type: 'start', purpose: 'check_in', resume: false },
      {
        type: 'started',
        attempt: { ...attempt, server_now: '2026-11-17T10:59:00Z' },
        now: T0 - 3 * 3600_000,
      },
    ])
    assert.equal(s.remainingMs, 60_000)
  })
  it('ticks do nothing before the attempt or after it', () => {
    assert.equal(examReducer(initialExam, { type: 'tick', now: T0 }), initialExam)
  })
})

describe('submitting', () => {
  it('a double click on submit is one submit', () => {
    const once = examReducer(running(), { type: 'submit' })
    assert.equal(once.phase, 'submitting')
    assert.equal(examReducer(once, { type: 'submit' }), once)
  })
  it('a failed submit offers a retry and keeps every answer', () => {
    let s = run(
      [
        { type: 'answer', itemId: 'q1', response: { option_id: 'o1' } },
        { type: 'submit' },
        { type: 'failed', kind: 'unreachable', retry: 'submit' },
      ],
      running()
    )
    assert.equal(s.phase, 'error')
    assert.deepEqual(s.answers.q1, { option_id: 'o1' })
    s = examReducer(s, { type: 'retry', now: T0 })
    assert.equal(s.phase, 'submitting')
  })
  it('ends submitted with the result, and updates the sync state', () => {
    let s = run([{ type: 'submit' }, { type: 'submitted', result: result('submitted') }], running())
    assert.equal(s.phase, 'submitted')
    s = examReducer(s, {
      type: 'result-updated',
      result: { ...result('submitted'), sync: { state: 'synced' } },
    })
    assert.equal(s.result?.sync.state, 'synced')
  })
})

describe('sections', () => {
  it('a section that fails to load can be retried and does not stop the others', () => {
    let s = run([{ type: 'section-failed', index: 1 }], running())
    assert.equal(s.sectionError, 1)
    assert.equal(s.phase, 'running')
    s = examReducer(s, { type: 'section-retry' })
    assert.equal(s.sectionError, null)
  })
})

describe('review', () => {
  it('lists the unanswered items by number once every section is loaded', () => {
    let s = running()
    assert.equal(allSectionsLoaded(s), true)
    s = run([{ type: 'answer', itemId: 'q2', response: { option_id: 'o1' } }], s)
    assert.deepEqual(
      unansweredItems(s).map((n) => n.number),
      [1, 3]
    )
    s = examReducer(s, { type: 'open-review' })
    assert.equal(s.view, 'review')
    s = examReducer(s, { type: 'goto-section', index: 1 })
    assert.equal(s.view, 'section')
  })
  it('does not open the review when the exam is not running', () => {
    assert.equal(examReducer(initialExam, { type: 'open-review' }), initialExam)
  })
})
