import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { FlowProgressItem, QuizResult } from '../../embed/protocol.ts'
import {
  createFlowState,
  flowReducer,
  gateOf,
  isComplete,
  newCompletions,
  type FlowEvent,
  type FlowMode,
  type FlowState,
  type FlowStepInfo,
} from './flowReducer.ts'

const step = (patch: Partial<FlowStepInfo> & Pick<FlowStepInfo, 'key' | 'type'>): FlowStepInfo => ({
  mandatory: true,
  revision: 1,
  minSeconds: 0,
  needsAck: false,
  allowFallback: true,
  ...patch,
})

const welcome = step({ key: 'welcome1', type: 'welcome' })
const video = step({ key: 'video001', type: 'video' })
const html = step({ key: 'html0001', type: 'html', minSeconds: 3, needsAck: true })
const pdf = step({ key: 'pdf00001', type: 'pdf', minSeconds: 2 })
const quiz = step({ key: 'quiz0001', type: 'quiz' })

const item = (stepKey: string, revision = 1, method: FlowProgressItem['method'] = 'completed') => ({
  stepKey,
  revision,
  method,
  completedAt: '2026-03-01T10:00:00Z',
})

const play = (state: FlowState, ...events: FlowEvent[]) => events.reduce(flowReducer, state)
const start = (steps: FlowStepInfo[], items: FlowProgressItem[] = [], mode: FlowMode = 'normal') =>
  createFlowState(steps, items, mode)
const ticks = (n: number): FlowEvent[] => Array.from({ length: n }, () => ({ type: 'tick' }))
const result = (patch: Partial<QuizResult> = {}): QuizResult => ({
  attempts: 1,
  finishedAttempts: 1,
  inProgress: false,
  percent: 80,
  pendingGrading: false,
  passedThreshold: true,
  ...patch,
})
const here = (state: FlowState) => state.steps[state.index].key

describe('welcome steps', () => {
  it('continue at once and record completed', () => {
    const state = start([welcome, video])
    assert.equal(gateOf(state).canContinue, true)
    const next = play(state, { type: 'next' })
    assert.equal(here(next), 'video001')
    assert.deepEqual(next.done.welcome1, { revision: 1, method: 'completed' })
  })
})

describe('video steps', () => {
  const at = () => start([video])
  it('Continuar waits for the end', () => {
    let state = at()
    assert.equal(gateOf(state).canContinue, false)
    assert.equal(gateOf(state).waitingFor, 'video')
    state = play(state, { type: 'video', event: { type: 'click' } })
    state = play(state, { type: 'video', event: { type: 'signal', signal: 'playing' } })
    assert.equal(gateOf(state).canContinue, false)
    state = play(state, { type: 'video', event: { type: 'signal', signal: 'ended' } })
    assert.equal(gateOf(state).canContinue, true)
    assert.equal(gateOf(state).method, 'completed')
  })
  it('the way out unlocks it and records fallback, only in trouble and with allowFallback', () => {
    let state = play(at(), { type: 'video-fallback' })
    assert.equal(gateOf(state).canContinue, false, 'no trouble yet')
    state = play(
      at(),
      { type: 'video', event: { type: 'click' } },
      { type: 'video', event: { type: 'timeout' } },
      { type: 'video-fallback' }
    )
    assert.equal(gateOf(state).canContinue, true)
    assert.equal(gateOf(state).method, 'fallback')
    const strict = start([{ ...video, allowFallback: false }])
    const stuck = play(
      strict,
      { type: 'video', event: { type: 'click' } },
      { type: 'video', event: { type: 'timeout' } },
      { type: 'video-fallback' }
    )
    assert.equal(gateOf(stuck).canContinue, false)
  })
  it('a video that ended after the fallback records completed', () => {
    const state = play(
      at(),
      { type: 'video', event: { type: 'click' } },
      { type: 'video', event: { type: 'timeout' } },
      { type: 'video-fallback' },
      { type: 'video', event: { type: 'signal', signal: 'ended' } }
    )
    assert.equal(gateOf(state).method, 'completed')
  })
  it('an optional video continues at once but records nothing when skipped', () => {
    const state = start([{ ...video, mandatory: false }])
    assert.equal(gateOf(state).canContinue, true)
    assert.equal(gateOf(state).canSkip, true)
    const next = play(state, { type: 'next' })
    assert.deepEqual(next.done, {})
    assert.equal(next.finished, true)
  })
})

describe('html and pdf steps', () => {
  it('wait for the visible seconds and the acknowledgement', () => {
    let state = start([html])
    assert.equal(gateOf(state).waitingFor, 'time-and-ack')
    assert.equal(gateOf(state).secondsLeft, 3)
    state = play(state, ...ticks(3))
    assert.equal(gateOf(state).waitingFor, 'ack')
    assert.equal(gateOf(state).canContinue, false)
    state = play(state, { type: 'ack', checked: true })
    assert.equal(gateOf(state).canContinue, true)
    state = play(state, { type: 'ack', checked: false })
    assert.equal(gateOf(state).canContinue, false, 'unticking locks it again')
  })
  it('the acknowledgement alone is not enough while time is left', () => {
    const state = play(start([html]), { type: 'ack', checked: true }, ...ticks(2))
    assert.equal(gateOf(state).waitingFor, 'time')
    assert.equal(gateOf(state).secondsLeft, 1)
  })
  it('with neither, enabled at once', () => {
    assert.equal(gateOf(start([{ ...pdf, minSeconds: 0 }])).canContinue, true)
  })
  it('time counts per step and ticks elsewhere do nothing', () => {
    let state = start([welcome, pdf])
    state = play(state, ...ticks(5))
    assert.deepEqual(state.seconds, {})
    state = play(state, { type: 'next' }, ...ticks(1))
    assert.equal(gateOf(state).secondsLeft, 1)
  })
})

describe('quiz steps', () => {
  const at = () => start([quiz, welcome])
  const withGate = (gate: Extract<FlowEvent, { type: 'quiz' }>['gate']) =>
    play(at(), { type: 'quiz', gate })
  it('waits for a finished attempt', () => {
    assert.equal(gateOf(at()).canContinue, false)
    assert.equal(gateOf(withGate({ kind: 'pending' })).canContinue, false)
    const inProgress = withGate({
      kind: 'result',
      result: result({ attempts: 1, finishedAttempts: 0, inProgress: true, percent: null }),
    })
    assert.equal(gateOf(inProgress).canContinue, false)
    assert.equal(gateOf(inProgress).waitingFor, 'quiz')
  })
  it('a finished attempt completes it, whatever the grade or its visibility', () => {
    for (const patch of [
      {},
      { passedThreshold: false, percent: 40 },
      { passedThreshold: null, percent: null },
      { pendingGrading: true, passedThreshold: null, percent: null },
    ]) {
      const state = withGate({ kind: 'result', result: result(patch) })
      assert.equal(gateOf(state).canContinue, true)
      assert.equal(gateOf(state).method, 'completed')
    }
  })
  it('unavailable never blocks and records unavailable', () => {
    for (const reason of [
      'unlinked',
      'restricted',
      'hidden',
      'missing',
      'not_found',
      'silent',
    ] as const) {
      const state = withGate({ kind: 'unavailable', reason })
      assert.equal(gateOf(state).canContinue, true, reason)
      assert.equal(gateOf(state).method, 'unavailable', reason)
    }
    const next = play(withGate({ kind: 'unavailable', reason: 'hidden' }), { type: 'next' })
    assert.deepEqual(next.done.quiz0001, { revision: 1, method: 'unavailable' })
  })
})

describe('content that cannot be served', () => {
  it('does not block and records unavailable', () => {
    let state = start([pdf, welcome])
    assert.equal(gateOf(state).canContinue, false)
    state = play(state, { type: 'unavailable' })
    assert.equal(gateOf(state).canContinue, true)
    assert.equal(gateOf(state).method, 'unavailable')
    state = play(state, { type: 'next' })
    assert.deepEqual(state.done.pdf00001, { revision: 1, method: 'unavailable' })
  })
})

describe('resume and revisions', () => {
  const steps = [welcome, video, html, quiz]
  it('starts at the first mandatory step not done', () => {
    assert.equal(here(start(steps)), 'welcome1')
    assert.equal(here(start(steps, [item('welcome1')])), 'video001')
    assert.equal(
      here(start(steps, [item('welcome1'), item('video001'), item('html0001')])),
      'quiz0001'
    )
  })
  it('earlier steps stay reachable with Atras, later ones do not', () => {
    let state = start(steps, [item('welcome1'), item('video001')])
    assert.equal(here(state), 'html0001')
    state = play(state, { type: 'back' })
    assert.equal(here(state), 'video001')
    assert.equal(gateOf(state).canContinue, true, 'a done step is open when revisited')
    state = play(state, { type: 'goto', index: 3 })
    assert.equal(here(state), 'video001', 'ahead of the progress is not reachable')
    state = play(state, { type: 'goto', index: 2 })
    assert.equal(here(state), 'html0001')
    assert.equal(play(start(steps), { type: 'back' }).index, 0, 'no Atras on the first step')
  })
  it('a raised revision asks again; the old one does not count', () => {
    const raised = steps.map((s) => (s.key === 'video001' ? { ...s, revision: 2 } : s))
    const state = start(raised, [item('welcome1'), item('video001', 1), item('html0001')])
    assert.equal(here(state), 'video001')
    assert.equal(
      here(
        start(raised, [item('welcome1'), item('video001', 2), item('html0001'), item('quiz0001')])
      ),
      'welcome1',
      'everything done: a review starts at the beginning'
    )
  })
  it('a step added later is asked, the rest stays done', () => {
    const grown = [...steps, step({ key: 'newstep01', type: 'html' })]
    const items = ['welcome1', 'video001', 'html0001', 'quiz0001'].map((key) => item(key))
    assert.equal(here(start(grown, items)), 'newstep01')
    assert.equal(isComplete(steps, items), true)
    assert.equal(isComplete(grown, items), false)
  })
  it('optional steps never hold the resume point', () => {
    const optional = [welcome, { ...video, mandatory: false }, html]
    assert.equal(here(start(optional, [item('welcome1')])), 'html0001')
  })
  it('a late host answer only adds completions', () => {
    let state = start(steps)
    state = play(state, { type: 'next' })
    state = play(state, { type: 'progress', items: [item('video001', 1, 'fallback')] })
    assert.equal(state.done.video001.method, 'fallback')
    assert.equal(state.done.welcome1.method, 'completed', 'what the viewer did is kept')
    const stale = play(state, { type: 'progress', items: [] })
    assert.deepEqual(stale.done, state.done)
  })
})

describe('finishing, modes and what gets persisted', () => {
  it('going past the last step finishes the flow', () => {
    const state = play(start([welcome]), { type: 'next' })
    assert.equal(state.finished, true)
  })
  it('only mandatory completions are reported, once', () => {
    const steps = [welcome, { ...video, mandatory: false }, { ...pdf, minSeconds: 0 }]
    let state = start(steps)
    const trail: string[] = []
    for (const event of [{ type: 'next' }, { type: 'next' }, { type: 'next' }] as FlowEvent[]) {
      const next = play(state, event)
      trail.push(...newCompletions(state, next).map((c) => `${c.stepKey}:${c.method}`))
      state = next
    }
    assert.deepEqual(trail, ['welcome1:completed', 'pdf00001:completed'])
  })
  it('a fallback and an unavailable quiz are reported as such', () => {
    const steps = [video, quiz]
    let state = start(steps)
    const before = state
    state = play(
      state,
      { type: 'video', event: { type: 'click' } },
      { type: 'video', event: { type: 'timeout' } },
      { type: 'video-fallback' },
      { type: 'next' }
    )
    assert.deepEqual(newCompletions(before, state), [
      { stepKey: 'video001', revision: 1, method: 'fallback' },
    ])
    const mid = state
    state = play(
      state,
      { type: 'quiz', gate: { kind: 'unavailable', reason: 'unlinked' } },
      { type: 'next' }
    )
    assert.deepEqual(newCompletions(mid, state), [
      { stepKey: 'quiz0001', revision: 1, method: 'unavailable' },
    ])
  })
  it('a flow with no mandatory step leaves one presence mark when finished', () => {
    const steps = [
      { ...welcome, mandatory: false },
      { ...video, mandatory: false },
    ]
    let state = start(steps)
    const before = state
    state = play(state, { type: 'skip' }, { type: 'skip' })
    assert.equal(state.finished, true)
    assert.deepEqual(newCompletions(before, state), [
      { stepKey: 'video001', revision: 1, method: 'completed' },
    ])
    assert.equal(isComplete(steps, [item('video001')]), true)
    assert.equal(isComplete(steps, []), false)
  })
  it('review mode: everything unlocked, nothing recorded, starts at the beginning', () => {
    const steps = [welcome, video, html, quiz]
    let state = start(
      steps,
      [item('welcome1'), item('video001'), item('html0001'), item('quiz0001')],
      'review'
    )
    assert.equal(state.index, 0)
    assert.equal(state.furthest, 3)
    for (let i = 0; i < steps.length; i++) {
      assert.equal(gateOf(state).canContinue, true)
      const before = state
      state = play(state, { type: 'next' })
      assert.deepEqual(newCompletions(before, state), [])
    }
    assert.equal(state.finished, true)
    assert.deepEqual(state.done, {})
    assert.equal(play(start(steps, [], 'review'), { type: 'goto', index: 3 }).index, 3)
  })
  it('preview records nothing to persist and ignores the host progress', () => {
    const steps = [welcome, video]
    const state = start(steps, [item('welcome1')], 'preview')
    assert.equal(here(state), 'welcome1')
    const next = play(state, { type: 'next' })
    assert.deepEqual(newCompletions(state, next), [])
    assert.equal(
      play(state, { type: 'progress', items: [item('video001')] }).done.video001,
      undefined
    )
  })
  it('a finished flow ignores everything', () => {
    const done = play(start([welcome]), { type: 'next' })
    assert.equal(flowReducer(done, { type: 'back' }), done)
  })
  it('skip needs an optional step; Continuar needs the gate on a mandatory one', () => {
    const state = start([html, welcome])
    assert.equal(play(state, { type: 'skip' }), state)
    assert.equal(play(state, { type: 'next' }), state)
  })
  it('noise for another step type changes nothing', () => {
    const state = start([welcome, video])
    for (const event of [
      { type: 'ack', checked: true },
      { type: 'video', event: { type: 'click' } },
      { type: 'video-fallback' },
      { type: 'quiz', gate: { kind: 'pending' } },
    ] as FlowEvent[])
      assert.equal(play(state, event), state)
  })
})
