import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { es } from '../../../i18n/es.ts'
import type { ActivityView } from '../../embed/hostActivities.ts'
import {
  activityStepModel,
  type ActivityMessage,
  type ActivityOpenLabel,
} from './activityStepView.ts'
import {
  createFlowState,
  flowReducer,
  gateOf,
  newCompletions,
  type FlowEvent,
  type FlowStepInfo,
} from './flowReducer.ts'

// The Moodle-activity step: what the card says in every state, and how the flow gates on it.

const text = es.flow.activity
const filled = (value: unknown) => typeof value === 'string' && value.trim().length > 0

const MESSAGES: ActivityMessage[] = [
  'hint',
  'open',
  'seen',
  'not_found',
  'forbidden',
  'unsupported',
  'no_host',
  'silent',
]
const LABELS: ActivityOpenLabel[] = ['open', 'opening', 'reopen', 'retry']

const VIEWS: ActivityView[] = [
  { status: 'idle' },
  { status: 'opening' },
  { status: 'open' },
  { status: 'seen' },
  { status: 'failed', reason: 'not_found' },
  { status: 'failed', reason: 'forbidden' },
  { status: 'failed', reason: 'unsupported' },
]

describe('the activity step has words for every state', () => {
  it('a translation for each message and each button label', () => {
    for (const key of MESSAGES) assert.ok(filled(text.messages[key]), key)
    for (const key of LABELS) assert.ok(filled(text[key]), key)
    assert.ok(filled(text.escape) && filled(text.escapeHint))
    assert.ok(filled(es.flow.waiting.activity))
    assert.match(text.cardLabel('Guía'), /Guía/)
  })

  it('every state the model can reach points at a message that exists', () => {
    for (const capability of [true, false])
      for (const silent of [true, false])
        for (const view of VIEWS) {
          const model = activityStepModel({ capability, view, silent })
          assert.ok(MESSAGES.includes(model.message), `${capability} ${silent} ${view.status}`)
          assert.ok(filled(text.messages[model.message]))
          if (model.openLabel) assert.ok(filled(text[model.openLabel]))
        }
  })

  it('never shows a raw code to the student', () => {
    for (const key of MESSAGES) assert.doesNotMatch(text.messages[key], /not_found|forbidden|_/)
  })
})

describe('what the card does in each state', () => {
  const model = (view: ActivityView, extra: { capability?: boolean; silent?: boolean } = {}) =>
    activityStepModel({ capability: true, silent: false, view, ...extra })

  it('idle offers to open', () => {
    const m = model({ status: 'idle' })
    assert.deepEqual([m.openLabel, m.openDisabled, m.busy, m.escape], ['open', false, false, false])
  })
  it('opening is busy and cannot be pressed twice', () => {
    const m = model({ status: 'opening' })
    assert.deepEqual([m.openLabel, m.openDisabled, m.busy], ['opening', true, true])
  })
  it('a host that never answers gives the button back, with a way out', () => {
    const m = model({ status: 'opening' }, { silent: true })
    assert.deepEqual(
      [m.message, m.openLabel, m.openDisabled, m.busy, m.escape],
      ['silent', 'retry', false, false, true]
    )
  })
  it('open waits for the overlay to close', () => {
    const m = model({ status: 'open' })
    assert.deepEqual([m.message, m.openDisabled, m.seen], ['open', true, false])
  })
  it('closed after being shown is seen, and can be opened again', () => {
    const m = model({ status: 'seen' })
    assert.deepEqual(
      [m.message, m.openLabel, m.openDisabled, m.seen],
      ['seen', 'reopen', false, true]
    )
  })
  it('not found and unsupported are "not available": no button, the step does not block', () => {
    for (const reason of ['not_found', 'unsupported'] as const) {
      const m = model({ status: 'failed', reason })
      assert.deepEqual(
        [m.message, m.openLabel, m.unavailable, m.escape],
        [reason, null, true, false]
      )
    }
  })
  it('forbidden can be retried and has the way out', () => {
    const m = model({ status: 'failed', reason: 'forbidden' })
    assert.deepEqual(
      [m.message, m.openLabel, m.unavailable, m.escape],
      ['forbidden', 'retry', false, true]
    )
  })
  it('a host without the capability says so, offers nothing and does not block', () => {
    for (const view of VIEWS) {
      const m = model(view, { capability: false })
      assert.deepEqual(
        [m.message, m.openLabel, m.unavailable, m.escape],
        ['no_host', null, true, false],
        view.status
      )
    }
  })
})

describe('how the flow gates on an activity step', () => {
  const activity: FlowStepInfo = {
    key: 'activity01',
    type: 'moodle_activity',
    mandatory: true,
    revision: 1,
    minSeconds: 0,
    needsAck: false,
    allowFallback: false,
  }
  const after: FlowStepInfo = { ...activity, key: 'activity02', type: 'html' }
  const play = (state: ReturnType<typeof createFlowState>, ...events: FlowEvent[]) =>
    events.reduce(flowReducer, state)
  const start = (editor = false) => createFlowState([activity, after], [], 'normal', editor)

  it('waits until the activity was seen', () => {
    const state = start()
    assert.deepEqual([gateOf(state).canContinue, gateOf(state).waitingFor], [false, 'activity'])
    const seen = play(state, { type: 'activity-seen' })
    assert.deepEqual([gateOf(seen).canContinue, gateOf(seen).method], [true, 'completed'])
  })

  it('records the step as completed when the viewer continues after seeing it', () => {
    const moved = play(start(), { type: 'activity-seen' }, { type: 'next' })
    assert.equal(moved.index, 1)
    assert.deepEqual(moved.done[activity.key], { revision: 1, method: 'completed' })
    assert.deepEqual(newCompletions(start(), moved), [
      { stepKey: activity.key, revision: 1, method: 'completed' },
    ])
  })

  it('the escape records a fallback and moves on, never a completion', () => {
    const moved = play(start(), { type: 'activity-escape' })
    assert.equal(moved.index, 1)
    assert.deepEqual(moved.done[activity.key], { revision: 1, method: 'fallback' })
  })

  it('a step that cannot be shown does not block and records `unavailable`', () => {
    const state = play(start(), { type: 'unavailable' })
    assert.equal(gateOf(state).canContinue, true)
    assert.equal(gateOf(state).method, 'unavailable')
  })

  it('an editor is not blocked either, and the record says so', () => {
    const gate = gateOf(start(true))
    assert.deepEqual([gate.canContinue, gate.method], [true, 'fallback'])
  })

  it('a "seen" for another step changes nothing', () => {
    const onOther = play(createFlowState([after, activity], [], 'normal'), {
      type: 'activity-seen',
    })
    assert.deepEqual(onOther.activitySeen, {})
  })

  it('a review records nothing and the escape is not offered there', () => {
    const review = createFlowState([activity, after], [], 'review')
    assert.equal(flowReducer(review, { type: 'activity-escape' }), review)
    assert.equal(gateOf(review).canContinue, true)
  })
})
