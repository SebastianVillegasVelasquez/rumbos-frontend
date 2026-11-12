import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseHostMessage, toWireMessage } from './protocol.ts'

const progress = {
  type: 'rumbos:host-flow-progress',
  v: 1,
  mapId: 'map-1',
  items: [
    { stepKey: 'rulesabc1', revision: 1, method: 'completed', completedAt: '2026-03-01T10:00:00Z' },
    { stepKey: 'vid_2', revision: 0, method: 'fallback', completedAt: '2026-03-01T10:05:00.123Z' },
  ],
  persistent: true,
  config: { quizThreshold: 70 },
}

const quiz = {
  type: 'rumbos:host-quiz-result',
  v: 1,
  cmid: 42,
  result: {
    attempts: 2,
    finishedAttempts: 1,
    inProgress: true,
    percent: 85.5,
    pendingGrading: false,
    passedThreshold: true,
  },
}

describe('host-flow-progress', () => {
  it('accepts a well-formed message', () => {
    assert.deepEqual(parseHostMessage(progress), progress)
  })
  it('accepts the two error answers and nothing else', () => {
    for (const error of ['readonly', 'unavailable'])
      assert.deepEqual(parseHostMessage({ type: progress.type, v: 1, mapId: 'map-1', error }), {
        type: progress.type,
        v: 1,
        mapId: 'map-1',
        error,
      })
    assert.equal(parseHostMessage({ type: progress.type, v: 1, mapId: 'map-1', error: 'x' }), null)
  })
  it('rejects the whole message for one malformed item', () => {
    const bad = (item: unknown) =>
      parseHostMessage({ ...progress, items: [...progress.items, item] })
    const good = progress.items[0]
    assert.equal(bad({ ...good, stepKey: 'has space' }), null)
    assert.equal(bad({ ...good, stepKey: 'x'.repeat(17) }), null)
    assert.equal(bad({ ...good, revision: -1 }), null)
    assert.equal(bad({ ...good, revision: 1_000_001 }), null)
    assert.equal(bad({ ...good, revision: 1.5 }), null)
    assert.equal(bad({ ...good, method: 'skipped' }), null)
    assert.equal(bad({ ...good, completedAt: '2026-03-01' }), null)
    assert.equal(bad({ ...good, completedAt: '2026-03-01T10:00:00+02:00' }), null)
    assert.equal(bad('nope'), null)
  })
  it('needs persistent, a quiz threshold in 0..100 and a sane map id', () => {
    assert.equal(parseHostMessage({ ...progress, persistent: 'yes' }), null)
    assert.equal(parseHostMessage({ ...progress, config: { quizThreshold: 101 } }), null)
    assert.equal(parseHostMessage({ ...progress, config: {} }), null)
    assert.equal(parseHostMessage({ ...progress, mapId: '' }), null)
    assert.equal(parseHostMessage({ ...progress, mapId: '<img onerror=x>' }), null)
    assert.equal(parseHostMessage({ ...progress, v: 2 }), null)
  })
  it('is bounded', () => {
    const many = Array.from({ length: 101 }, () => progress.items[0])
    assert.equal(parseHostMessage({ ...progress, items: many }), null)
  })
})

describe('host-quiz-result', () => {
  it('accepts a result and a hidden grade as neutral', () => {
    assert.deepEqual(parseHostMessage(quiz), quiz)
    const hidden = parseHostMessage({
      ...quiz,
      result: { ...quiz.result, percent: null, passedThreshold: null },
    })
    assert.equal(hidden?.type === 'rumbos:host-quiz-result' && hidden.result?.percent, null)
  })
  it('accepts the three error answers', () => {
    for (const error of ['not_found', 'unavailable', 'capability'])
      assert.deepEqual(parseHostMessage({ type: quiz.type, v: 1, cmid: 42, error }), {
        type: quiz.type,
        v: 1,
        cmid: 42,
        error,
      })
    assert.equal(parseHostMessage({ type: quiz.type, v: 1, cmid: 42, error: 'boom' }), null)
  })
  it('rejects impossible numbers instead of showing them', () => {
    const withResult = (patch: object) =>
      parseHostMessage({ ...quiz, result: { ...quiz.result, ...patch } })
    assert.equal(withResult({ finishedAttempts: 3 }), null, 'more finished than attempts')
    assert.equal(withResult({ percent: 101 }), null)
    assert.equal(withResult({ percent: -1 }), null)
    assert.equal(withResult({ percent: '80' }), null)
    assert.equal(withResult({ attempts: -1 }), null)
    assert.equal(withResult({ inProgress: 1 }), null)
    assert.equal(withResult({ passedThreshold: 'true' }), null)
    assert.equal(parseHostMessage({ ...quiz, cmid: 0 }), null)
    assert.equal(parseHostMessage({ ...quiz, result: null }), null)
  })
})

describe('what the app sends for the flow', () => {
  it('passes well-formed messages through', () => {
    const messages = [
      { type: 'rumbos:request-flow-progress', v: 1, mapId: 'map-1' },
      {
        type: 'rumbos:flow-step-done',
        v: 1,
        mapId: 'map-1',
        stepKey: 'rulesabc1',
        revision: 2,
        method: 'fallback',
      },
      { type: 'rumbos:request-quiz-result', v: 1, cmid: 42 },
      { type: 'rumbos:flow-reset', v: 1, mapId: 'map-1' },
    ] as const
    for (const message of messages) assert.deepEqual(toWireMessage(message), message)
  })
  it('drops what does not fit the contract', () => {
    const base = { type: 'rumbos:flow-step-done', v: 1, mapId: 'map-1', stepKey: 'k1', revision: 1 }
    assert.equal(toWireMessage({ ...base, method: 'completed', stepKey: 'bad key' } as never), null)
    assert.equal(
      toWireMessage({ ...base, method: 'completed', revision: 1_000_001 } as never),
      null
    )
    assert.equal(toWireMessage({ ...base, method: 'viewed' } as never), null)
    assert.equal(toWireMessage({ type: 'rumbos:request-quiz-result', v: 1, cmid: 0 }), null)
    assert.equal(toWireMessage({ type: 'rumbos:flow-reset', v: 1, mapId: '' }), null)
  })
})
