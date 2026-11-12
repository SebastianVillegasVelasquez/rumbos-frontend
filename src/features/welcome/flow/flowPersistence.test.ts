import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { HostFlowProgress } from '../../embed/hostFlow.ts'
import {
  MAX_ATTEMPTS,
  MAX_WRITES_PER_MINUTE,
  WRITE_WINDOW_MS,
  PROGRESS_TIMEOUT_MS,
  createFlowPersistence,
  createWriteQueue,
  localFlagKey,
  retryDelay,
  type LocalStore,
} from './flowPersistence.ts'
import type { NewCompletion } from './flowReducer.ts'

// A fake clock: timers run only when the test advances time.
const clock = () => {
  let time = 0
  let nextId = 1
  const timers = new Map<number, { at: number; run: () => void }>()
  return {
    now: () => time,
    schedule: (run: () => void, delayMs: number) => {
      const id = nextId++
      timers.set(id, { at: time + delayMs, run })
      return () => void timers.delete(id)
    },
    advance: (ms: number) => {
      const end = time + ms
      for (;;) {
        const due = [...timers.entries()]
          .filter(([, timer]) => timer.at <= end)
          .sort((a, b) => a[1].at - b[1].at)[0]
        if (!due) break
        timers.delete(due[0])
        time = Math.max(time, due[1].at)
        due[1].run()
      }
      time = end
    },
  }
}

const memoryStore = (): LocalStore & { data: Map<string, string> } => {
  const data = new Map<string, string>()
  return {
    data,
    get: (key) => data.get(key) ?? null,
    set: (key, value) => void data.set(key, value),
  }
}

const done = (stepKey: string, revision = 1, method: NewCompletion['method'] = 'completed') => ({
  stepKey,
  revision,
  method,
})

describe('the write queue', () => {
  const setup = (confirmAfter = Infinity) => {
    const time = clock()
    const sent: Array<[number, string]> = []
    const confirmed = new Set<string>()
    const attemptsOf = new Map<string, number>()
    const queue = createWriteQueue({
      send: (completion) => {
        sent.push([time.now(), completion.stepKey])
        const n = (attemptsOf.get(completion.stepKey) ?? 0) + 1
        attemptsOf.set(completion.stepKey, n)
        if (n >= confirmAfter) confirmed.add(completion.stepKey)
      },
      isConfirmed: (completion) => confirmed.has(completion.stepKey),
      now: time.now,
      schedule: time.schedule,
    })
    return { time, sent, queue, confirmed }
  }

  it('sends at once and stops when the host confirms', () => {
    const { time, sent, queue } = setup(1)
    queue.enqueue(done('a'))
    assert.deepEqual(sent, [[0, 'a']])
    time.advance(120_000)
    assert.equal(sent.length, 1)
    assert.equal(queue.pending(), 0)
  })

  it('retries with growing delays and gives up: it never loops', () => {
    const { time, sent, queue } = setup()
    queue.enqueue(done('a'))
    time.advance(10 * 60_000)
    assert.equal(sent.length, MAX_ATTEMPTS)
    const gaps = sent.slice(1).map(([at], i) => at - sent[i][0])
    for (let i = 1; i < gaps.length; i++) assert.ok(gaps[i] >= gaps[i - 1], 'delays do not shrink')
    assert.ok(gaps[0] >= retryDelay(1))
    assert.equal(queue.pending(), 0, 'dropped after the last attempt')
    time.advance(10 * 60_000)
    assert.equal(sent.length, MAX_ATTEMPTS, 'nothing more is ever sent')
  })

  it('retries until the host finally confirms', () => {
    const { time, sent, queue } = setup(3)
    queue.enqueue(done('a'))
    time.advance(10 * 60_000)
    assert.equal(sent.length, 3)
    assert.equal(queue.pending(), 0)
  })

  it('a flow of 12 steps clicked through at once loses nothing', () => {
    const { time, sent, queue } = setup(1)
    for (let i = 0; i < 12; i++) queue.enqueue(done(`step${i}`))
    assert.equal(sent.length, 12, 'all sent at once')
    assert.ok(sent.every(([at]) => at === 0))
    time.advance(WRITE_WINDOW_MS)
    assert.equal(queue.pending(), 0)
  })

  it('never more than 28 writes in any minute, even when nothing is confirmed', () => {
    const { time, sent, queue } = setup()
    for (let i = 0; i < 40; i++) queue.enqueue(done(`step${i}`))
    time.advance(20 * 60_000)
    for (const [start] of sent) {
      const inWindow = sent.filter(([at]) => at >= start && at < start + WRITE_WINDOW_MS).length
      assert.ok(inWindow <= MAX_WRITES_PER_MINUTE, `${inWindow} writes in a minute`)
    }
  })

  it('the same step queued twice is one write', () => {
    const { time, sent, queue } = setup(1)
    queue.enqueue(done('a'))
    queue.enqueue(done('b'))
    queue.enqueue(done('b'))
    time.advance(60_000)
    assert.deepEqual(
      sent.map(([, key]) => key),
      ['a', 'b']
    )
  })

  it('drain hands back what is unconfirmed, and dispose stops the timers', () => {
    const { time, sent, queue } = setup()
    queue.enqueue(done('a'))
    assert.deepEqual(queue.drain(), [done('a')])
    queue.enqueue(done('b'))
    queue.dispose()
    const before = sent.length
    time.advance(10 * 60_000)
    assert.equal(sent.length, before)
  })
})

describe('loading and recording the progress', () => {
  const setup = (view: () => HostFlowProgress | null = () => null, hasHost = true) => {
    const time = clock()
    const store = memoryStore()
    const sent: NewCompletion[] = []
    let requests = 0
    const listeners = new Set<() => void>()
    let current: HostFlowProgress | null = view()
    const persistence = createFlowPersistence({
      mapId: 'map1',
      steps: [
        { key: 'welcome1', revision: 1 },
        { key: 'video001', revision: 2 },
      ],
      requestProgress: () => void requests++,
      reportDone: (completion) => void sent.push(completion),
      hostProgress: () => current,
      subscribeHost: (listener) => {
        listeners.add(listener)
        return () => void listeners.delete(listener)
      },
      store,
      hasHost,
      now: time.now,
      schedule: time.schedule,
    })
    return {
      time,
      store,
      sent,
      persistence,
      requests: () => requests,
      answer: (next: HostFlowProgress) => {
        current = next
        listeners.forEach((listener) => listener())
      },
    }
  }
  const ready = (items: Array<[string, number]>, persistent = true): HostFlowProgress => ({
    status: 'ready',
    items: items.map(([stepKey, revision]) => ({
      stepKey,
      revision,
      method: 'completed' as const,
      completedAt: '2026-03-01T10:00:00Z',
    })),
    persistent,
    quizThreshold: 70,
    receivedAt: 0,
  })

  it('asks the host and loads what it answers', async () => {
    const t = setup()
    const loading = t.persistence.load()
    assert.equal(t.requests(), 1)
    t.answer(ready([['welcome1', 1]]))
    const loaded = await loading
    assert.equal(loaded.source, 'host')
    assert.deepEqual(loaded.entries, [{ stepKey: 'welcome1', revision: 1, method: 'completed' }])
    assert.equal(loaded.quizThreshold, 70)
  })

  it('no answer in 3 seconds: the viewer-local flag', async () => {
    const t = setup()
    t.store.set(localFlagKey('map1', 'welcome1', 1), 'completed')
    const loading = t.persistence.load()
    t.time.advance(PROGRESS_TIMEOUT_MS - 1)
    t.time.advance(1)
    const loaded = await loading
    assert.equal(loaded.source, 'local')
    assert.deepEqual(loaded.entries, [{ stepKey: 'welcome1', revision: 1, method: 'completed' }])
  })

  it('without a host the local flag is used at once, with no request', async () => {
    const t = setup(() => null, false)
    t.store.set(localFlagKey('map1', 'welcome1', 1), 'completed')
    const loaded = await t.persistence.load()
    assert.equal(loaded.source, 'local')
    assert.equal(loaded.entries.length, 1)
    assert.equal(t.requests(), 0)
  })

  it('a late answer after the fallback changes nothing', async () => {
    const t = setup()
    const loading = t.persistence.load()
    t.time.advance(PROGRESS_TIMEOUT_MS)
    await loading
    t.answer(ready([['welcome1', 1]]))
    assert.equal(t.persistence.source(), 'local')
  })

  it('the local flag is per step key and revision', async () => {
    const t = setup()
    t.store.set(localFlagKey('map1', 'video001', 1), 'completed')
    t.store.set(localFlagKey('other', 'welcome1', 1), 'completed')
    const loading = t.persistence.load()
    t.time.advance(PROGRESS_TIMEOUT_MS)
    assert.deepEqual((await loading).entries, [], 'revision 1 of a step now at 2, and another map')
  })

  it('errors from the host behave like silence', async () => {
    for (const error of ['readonly', 'unavailable'] as const) {
      const t = setup()
      const loading = t.persistence.load()
      t.answer({ status: 'error', error })
      assert.equal((await loading).source, 'local')
    }
  })

  it('persistent false means memory only: nothing sent, nothing stored', async () => {
    const t = setup()
    const loading = t.persistence.load()
    t.answer(ready([], false))
    assert.equal((await loading).source, 'memory')
    t.persistence.record([done('welcome1')])
    t.time.advance(60_000)
    assert.deepEqual(t.sent, [])
    assert.equal(t.store.data.size, 0)
  })

  it('records go to the host with retries until confirmed', async () => {
    const t = setup()
    const loading = t.persistence.load()
    t.answer(ready([]))
    await loading
    t.persistence.record([done('welcome1')])
    assert.equal(t.sent.length, 1)
    t.time.advance(4_000)
    assert.equal(t.sent.length, 2, 'not confirmed yet: retried')
    t.answer(ready([['welcome1', 1]]))
    t.time.advance(60_000)
    assert.equal(t.sent.length, 2, 'confirmed: no more')
    assert.equal(t.store.data.size, 0, 'nothing local while the host keeps it')
  })

  it('records go to the local flag when the host is silent', async () => {
    const t = setup()
    const loading = t.persistence.load()
    t.time.advance(PROGRESS_TIMEOUT_MS)
    await loading
    t.persistence.record([done('video001', 2, 'fallback')])
    assert.equal(t.store.get(localFlagKey('map1', 'video001', 2)), 'fallback')
    assert.deepEqual(t.sent, [])
  })

  it('a host that stops recording hands its queue to the local flag', async () => {
    const t = setup()
    const loading = t.persistence.load()
    t.answer(ready([]))
    await loading
    t.persistence.record([done('welcome1')])
    t.answer({ status: 'error', error: 'readonly' })
    assert.equal(t.persistence.source(), 'local')
    assert.equal(t.store.get(localFlagKey('map1', 'welcome1', 1)), 'completed')
    const sentBefore = t.sent.length
    t.time.advance(60_000)
    assert.equal(t.sent.length, sentBefore)
  })

  it('dispose stops everything', async () => {
    const t = setup()
    const loading = t.persistence.load()
    t.answer(ready([]))
    await loading
    t.persistence.record([done('welcome1')])
    t.persistence.dispose()
    const sentBefore = t.sent.length
    t.time.advance(60_000)
    assert.equal(t.sent.length, sentBefore)
    t.persistence.record([done('video001', 2)])
    assert.equal(t.sent.length, sentBefore)
  })
})
