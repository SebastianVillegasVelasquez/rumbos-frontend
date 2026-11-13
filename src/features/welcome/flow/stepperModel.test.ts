import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createFlowState,
  flowReducer,
  type FlowState,
  type FlowStepInfo,
  type ProgressEntry,
} from './flowReducer.ts'
import { stepperSegments } from './stepperModel.ts'

const step = (key: string, type: FlowStepInfo['type'] = 'welcome'): FlowStepInfo => ({
  key,
  type,
  mandatory: true,
  revision: 1,
  minSeconds: 0,
  needsAck: false,
  allowFallback: false,
})

const steps = [step('a'), step('b', 'video'), step('c', 'quiz')]
const kinds = (state: FlowState) => stepperSegments(state).map((segment) => segment.kind)

describe('stepper segments', () => {
  it('a fresh flow: the first step is current, the rest are locked', () => {
    assert.deepEqual(kinds(createFlowState(steps, [], 'normal')), ['current', 'locked', 'locked'])
  })

  it('exactly one segment is current, and it is the step the label names', () => {
    let state = createFlowState(steps, [], 'normal')
    state = flowReducer(state, { type: 'next' })
    const current = stepperSegments(state).filter((segment) => segment.kind === 'current')
    assert.equal(current.length, 1)
    assert.equal(current[0].index, state.index)
  })

  it('going back keeps the label and the highlight on the same step', () => {
    let state = createFlowState(steps, [], 'normal')
    state = flowReducer(state, { type: 'next' })
    assert.equal(state.index, 1)
    state = flowReducer(state, { type: 'back' })
    assert.equal(state.index, 0)
    // The furthest step is "visited", not "current": the bug was reading as current.
    assert.deepEqual(kinds(state), ['current', 'visited', 'locked'])
  })

  it('a completed step is done when you are elsewhere, and says so while current', () => {
    let state = createFlowState(steps, [], 'normal')
    state = flowReducer(state, { type: 'next' })
    const done = stepperSegments(state)[0]
    assert.equal(done.kind, 'done')
    state = flowReducer(state, { type: 'back' })
    const back = stepperSegments(state)[0]
    assert.equal(back.kind, 'current')
    assert.equal(back.done, true)
  })

  it('progress from the host marks earlier steps done and resumes at the pending one', () => {
    const entries: ProgressEntry[] = [{ stepKey: 'a', revision: 1, method: 'completed' }]
    assert.deepEqual(kinds(createFlowState(steps, entries, 'normal')), [
      'done',
      'current',
      'locked',
    ])
  })

  it('a raised revision stops counting as done', () => {
    const entries: ProgressEntry[] = [{ stepKey: 'a', revision: 1, method: 'completed' }]
    const raised = [{ ...steps[0], revision: 2 }, steps[1], steps[2]]
    assert.equal(stepperSegments(createFlowState(raised, entries, 'normal'))[0].kind, 'current')
  })

  it('review mode unlocks every segment', () => {
    const state = createFlowState(steps, [], 'review')
    assert.ok(stepperSegments(state).every((segment) => segment.reachable))
    assert.deepEqual(kinds(state), ['current', 'visited', 'visited'])
  })
})
