import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { CourseState } from '../../embed/protocol.ts'
import {
  RESULT_ASK_GAP_MS,
  RESULT_SILENCE_MS,
  createQuizWatcher,
  gateFromView,
  quizAvailability,
} from './quizWatcher.ts'

const state = (patch: Partial<CourseState> = {}): CourseState => ({
  schemaVersion: 1,
  courseId: 1,
  generatedAt: 'now',
  sections: [],
  unavailableCmids: [],
  activities: [
    {
      cmid: 10,
      name: 'Quiz',
      modname: 'quiz',
      sectionId: 1,
      availability: 'available',
      availabilityInfo: null,
      completion: 'none',
    },
    {
      cmid: 11,
      name: 'Locked',
      modname: 'quiz',
      sectionId: 1,
      availability: 'restricted',
      availabilityInfo: 'x',
      completion: 'none',
    },
    {
      cmid: 12,
      name: 'Hidden for editors',
      modname: 'quiz',
      sectionId: 1,
      availability: 'hidden',
      availabilityInfo: null,
      completion: 'none',
    },
    {
      cmid: 13,
      name: 'A page',
      modname: 'page',
      sectionId: 1,
      availability: 'available',
      availabilityInfo: null,
      completion: 'none',
    },
  ],
  ...patch,
})

describe('quiz availability from the course state', () => {
  it('available quizzes are null (nothing to say)', () => {
    assert.equal(quizAvailability(state(), 10), null)
  })
  it('names why it does not block', () => {
    assert.equal(quizAvailability(state(), null), 'unlinked')
    assert.equal(quizAvailability(state(), 11), 'restricted')
    assert.equal(quizAvailability(state(), 12), 'hidden')
    assert.equal(quizAvailability(state(), 99), 'missing')
    assert.equal(quizAvailability(state(), 13), 'missing', 'not a quiz')
    assert.equal(quizAvailability(state({ unavailableCmids: [10] }), 10), 'hidden')
    assert.equal(quizAvailability(null, 10), 'missing')
  })
})

describe('the host answer as a gate', () => {
  it('maps every answer', () => {
    assert.deepEqual(gateFromView(null), { kind: 'pending' })
    assert.deepEqual(gateFromView({ status: 'error', error: 'not_found' }), {
      kind: 'unavailable',
      reason: 'not_found',
    })
    for (const error of ['unavailable', 'capability'] as const)
      assert.deepEqual(gateFromView({ status: 'error', error }), {
        kind: 'unavailable',
        reason: 'unavailable',
      })
    const result = {
      attempts: 1,
      finishedAttempts: 1,
      inProgress: false,
      percent: null,
      pendingGrading: false,
      passedThreshold: null,
    }
    assert.deepEqual(gateFromView({ status: 'ready', result, receivedAt: 0 }), {
      kind: 'result',
      result,
    })
  })
})

describe('when the quiz result is asked', () => {
  const setup = () => {
    let time = 0
    let nextId = 1
    const timers = new Map<number, { at: number; run: () => void }>()
    const asks: number[] = []
    let answered = 0
    let silent = 0
    const watcher = createQuizWatcher({
      ask: () => void asks.push(time),
      answeredCount: () => answered,
      now: () => time,
      schedule: (run, delay) => {
        const id = nextId++
        timers.set(id, { at: time + delay, run })
        return () => void timers.delete(id)
      },
      onSilent: () => void silent++,
    })
    const advance = (ms: number) => {
      const end = time + ms
      for (;;) {
        const due = [...timers.entries()]
          .filter(([, t]) => t.at <= end)
          .sort((a, b) => a[1].at - b[1].at)[0]
        if (!due) break
        timers.delete(due[0])
        time = Math.max(time, due[1].at)
        due[1].run()
      }
      time = end
    }
    return {
      watcher,
      asks,
      advance,
      answer: () => void answered++,
      silent: () => silent,
    }
  }

  it('asks when the step opens', () => {
    const t = setup()
    t.watcher.trigger('open')
    assert.equal(t.asks.length, 1)
  })

  it('the overlay closing then the state arriving: asks again for the fresh state', () => {
    const t = setup()
    t.watcher.trigger('open')
    t.answer()
    t.advance(5_000)
    t.watcher.trigger('overlay-closed')
    t.advance(300)
    t.watcher.trigger('host-state')
    t.advance(2_000)
    // The overlay trigger asked at once; the state, inside the gap, was deferred
    // and still asked: the result is requested again after the state refresh.
    assert.equal(t.asks.length, 3)
    assert.ok(t.asks[2] - t.asks[1] >= RESULT_ASK_GAP_MS)
  })

  it('a burst is two asks at most: the first at once, one deferred for the last trigger', () => {
    const t = setup()
    t.watcher.trigger('open')
    t.answer()
    t.advance(10_000)
    for (const trigger of ['visible', 'host-state', 'overlay-closed', 'host-state'] as const)
      t.watcher.trigger(trigger)
    assert.equal(t.asks.length, 2, 'the first of the burst goes at once')
    t.advance(10_000)
    assert.equal(t.asks.length, 3, 'the rest share one deferred ask')
  })

  it('a trigger inside the gap is deferred to its end', () => {
    const t = setup()
    t.watcher.trigger('open')
    t.answer()
    t.advance(100)
    t.watcher.trigger('host-state')
    assert.equal(t.asks.length, 1)
    t.advance(RESULT_ASK_GAP_MS)
    assert.equal(t.asks.length, 2)
  })

  it('a host that never answers stops the wait, once', () => {
    const t = setup()
    t.watcher.trigger('open')
    t.advance(RESULT_SILENCE_MS - 1)
    assert.equal(t.silent(), 0)
    t.advance(1)
    assert.equal(t.silent(), 1)
    t.advance(60_000)
    assert.equal(t.silent(), 1)
  })

  it('a host that answers is not silent', () => {
    const t = setup()
    t.watcher.trigger('open')
    t.answer()
    t.advance(RESULT_SILENCE_MS * 2)
    assert.equal(t.silent(), 0)
  })

  it('dispose cancels what is scheduled', () => {
    const t = setup()
    t.watcher.trigger('open')
    t.answer()
    t.advance(100)
    t.watcher.trigger('host-state')
    t.watcher.dispose()
    t.advance(60_000)
    assert.equal(t.asks.length, 1)
    t.watcher.trigger('open')
    assert.equal(t.asks.length, 1)
  })
})
