import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import type { HostFlowProgress } from '../../embed/hostFlow.ts'
import {
  browserLocalStore,
  createFlowPersistence,
  localFlagKey,
  type LocalStore,
} from './flowPersistence.ts'
import {
  createFlowState,
  flowReducer,
  newCompletions,
  toStepInfo,
  type FlowEvent,
  type FlowStepInfo,
  type NewCompletion,
} from './flowReducer.ts'
import { createQuizWatcher } from './quizWatcher.ts'

// Privacy: the progress of a viewer and their quiz results live in Moodle and in
// a flag local to the viewer. They never go to the backend, and they never reach
// logs or error reports. These tests fail if that changes.

const here = dirname(fileURLToPath(import.meta.url))
const embedDir = join(here, '..', '..', 'embed')

// Every module that handles flow progress, quiz data or step completion.
const sources = (): Array<{ file: string; code: string }> => {
  const flow = readdirSync(here)
    .filter((name) => /\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts'))
    .map((name) => join(here, name))
  const embed = ['hostFlow.ts'].map((name) => join(embedDir, name))
  return [...flow, ...embed].map((file) => ({ file, code: readFileSync(file, 'utf8') }))
}

// Comments may talk about the backend; code may not reach it.
const withoutComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('the flow code never reaches the backend', () => {
  const forbiddenImports = [
    'courseMapApi',
    'data/client',
    'data/queries',
    'draftMutations',
    'writeQueue',
    'mockCourseMapApi',
  ]
  const forbiddenCalls = [
    /\bfetch\s*\(/,
    /\bsendBeacon\b/,
    /\bXMLHttpRequest\b/,
    /\bWebSocket\b/,
    /\bEventSource\b/,
    /\bapiRequest\b/,
    /\bapiUpload\b/,
    /\buseMutation\b/,
    /\buseQuery\b/,
    /\bnew Image\b/,
  ]
  // The one allowed use of the API client: the origin that Rumbos assets are
  // served from, for the policy of an html step. It reads a constant, it sends
  // nothing.
  const allowedClientImport = (file: string) => file.endsWith('FlowSteps.tsx')

  for (const { file, code } of sources()) {
    const name = file.slice(file.indexOf('src'))
    it(`${name}: no backend imports or network calls`, () => {
      const text = withoutComments(code)
      for (const module of forbiddenImports) {
        if (module === 'data/client' && allowedClientImport(file)) {
          assert.match(text, /import \{ API_BASE_URL \} from '[^']*data\/client\.ts'/)
          continue
        }
        assert.ok(!new RegExp(`from '[^']*${module}[^']*'`).test(text), `imports ${module}`)
      }
      for (const pattern of forbiddenCalls) assert.ok(!pattern.test(text), `uses ${pattern}`)
    })
  }

  it('the flow never imports the error reporting or logging modules', () => {
    for (const { file, code } of sources()) {
      const text = withoutComments(code)
      for (const module of ['escalation', 'localErrors', 'hostReports', 'errorReason'])
        assert.ok(!text.includes(module), `${file} imports ${module}`)
      assert.ok(!/console\.(log|info|warn|error|debug)/.test(text), `${file} logs`)
      assert.ok(!/rumbos:error/.test(text), `${file} reports an error to the host`)
    }
  })

  it('the only persistence is the host message and the local flag', () => {
    for (const { file, code } of sources()) {
      const text = withoutComments(code)
      assert.ok(!/\bsessionStorage\b|\bindexedDB\b|\bdocument\.cookie\b/.test(text), file)
      // localStorage is reached through the viewer storage helper, in one place.
      if (!file.endsWith('flowPersistence.ts') && !file.endsWith('useFlowGate.ts'))
        assert.ok(!/\blocalStorage\b/.test(text), `${file} touches localStorage`)
    }
  })
})

// ---- A full run with every outbound channel watched ----------------------------------

describe('a full run sends nothing but the host messages and the local flag', () => {
  const infos: FlowStepInfo[] = [
    {
      key: 'welcome001',
      type: 'welcome',
      mandatory: true,
      revision: 1,
      minSeconds: 0,
      needsAck: false,
      allowFallback: false,
    },
    {
      key: 'video0001',
      type: 'video',
      mandatory: true,
      revision: 1,
      minSeconds: 0,
      needsAck: false,
      allowFallback: true,
    },
    {
      key: 'quiz00001',
      type: 'quiz',
      mandatory: true,
      revision: 1,
      minSeconds: 0,
      needsAck: false,
      allowFallback: false,
    },
  ]

  const watchChannels = () => {
    const calls: string[] = []
    const g = globalThis as Record<string, unknown>
    const saved = {
      fetch: g.fetch,
      XMLHttpRequest: g.XMLHttpRequest,
      console: { ...console },
    }
    g.fetch = (...args: unknown[]) => {
      calls.push(`fetch ${String(args[0])}`)
      return Promise.reject(new Error('no network in tests'))
    }
    g.XMLHttpRequest = class {
      constructor() {
        calls.push('XMLHttpRequest')
      }
    }
    for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const)
      console[level] = (...args: unknown[]) => void calls.push(`console.${level} ${args.join(' ')}`)
    return {
      calls,
      restore: () => {
        g.fetch = saved.fetch
        g.XMLHttpRequest = saved.XMLHttpRequest
        Object.assign(console, saved.console)
      },
    }
  }

  const run = (hostAnswers: boolean) => {
    const watch = watchChannels()
    const store = new Map<string, string>()
    const local: LocalStore = {
      get: (key) => store.get(key) ?? null,
      set: (key, value) => void store.set(key, value),
    }
    const hostMessages: unknown[] = []
    let time = 0
    const timers: Array<{ at: number; run: () => void }> = []
    let view: HostFlowProgress | null = null
    const listeners = new Set<() => void>()
    const persistence = createFlowPersistence({
      mapId: 'map-1',
      steps: infos,
      requestProgress: () => void hostMessages.push({ type: 'rumbos:request-flow-progress' }),
      reportDone: (completion) =>
        void hostMessages.push({ type: 'rumbos:flow-step-done', ...completion }),
      hostProgress: () => view,
      subscribeHost: (listener) => {
        listeners.add(listener)
        return () => void listeners.delete(listener)
      },
      store: local,
      now: () => time,
      schedule: (fn, delay) => {
        const entry = { at: time + delay, run: fn }
        timers.push(entry)
        return () => void timers.splice(timers.indexOf(entry) >>> 0, 1)
      },
    })
    const loading = persistence.load()
    if (hostAnswers) {
      view = { status: 'ready', items: [], persistent: true, quizThreshold: 70, receivedAt: 0 }
      listeners.forEach((listener) => listener())
    } else {
      time = 3_000
      for (const timer of timers.filter((entry) => entry.at <= time)) timer.run()
    }
    return { watch, store, hostMessages, persistence, loading }
  }

  const walk = (persistence: { record: (c: readonly NewCompletion[]) => void }) => {
    let state = createFlowState(infos, [], 'normal')
    const events: FlowEvent[] = [
      { type: 'next' },
      { type: 'video', event: { type: 'click' } },
      { type: 'video', event: { type: 'timeout' } },
      { type: 'video-fallback' },
      { type: 'next' },
      {
        type: 'quiz',
        gate: {
          kind: 'result',
          result: {
            attempts: 2,
            finishedAttempts: 2,
            inProgress: false,
            percent: 61.5,
            pendingGrading: false,
            passedThreshold: false,
          },
        },
      },
      { type: 'next' },
    ]
    for (const event of events) {
      const next = flowReducer(state, event)
      persistence.record(newCompletions(state, next))
      state = next
    }
    return state
  }

  for (const hostAnswers of [true, false]) {
    it(`${hostAnswers ? 'with a host that answers' : 'with a silent host (local flag)'}`, async () => {
      const t = run(hostAnswers)
      try {
        await t.loading
        const finished = walk(t.persistence)
        assert.equal(finished.finished, true)
        // Nothing touched the network, and nothing was logged.
        assert.deepEqual(t.watch.calls, [])
        if (hostAnswers) {
          const sent = t.hostMessages.filter(
            (m) => (m as { type: string }).type === 'rumbos:flow-step-done'
          )
          assert.equal(sent.length, 3)
          // The quiz result (percent, attempts) is in no outgoing message.
          assert.ok(!JSON.stringify(t.hostMessages).includes('61.5'))
          assert.equal(t.store.size, 0, 'nothing local while the host keeps it')
        } else {
          for (const key of t.store.keys()) assert.ok(key.startsWith('rumbos.welcome.flow.'), key)
          // The flag holds the method and nothing else: no grade, no attempts.
          for (const value of t.store.values())
            assert.ok(['completed', 'fallback', 'unavailable'].includes(value), value)
          assert.equal(t.store.get(localFlagKey('map-1', 'video0001', 1)), 'fallback')
        }
      } finally {
        t.persistence.dispose()
        t.watch.restore()
      }
    })
  }

  it('the quiz watcher only asks the host, with a cmid and nothing else', () => {
    const watch = watchChannels()
    try {
      const asked: unknown[] = []
      const watcher = createQuizWatcher({
        ask: () => void asked.push('ask'),
        answeredCount: () => 0,
        now: () => 0,
        schedule: () => () => {},
        onSilent: () => {},
      })
      watcher.trigger('open')
      assert.deepEqual(asked, ['ask'])
      assert.deepEqual(watch.calls, [])
    } finally {
      watch.restore()
    }
  })

  it('the browser local store keeps the flag where the viewer is, and only the method', () => {
    const backing = new Map<string, string>()
    const store = browserLocalStore(
      () =>
        ({
          getItem: (key: string) => backing.get(key) ?? null,
          setItem: (key: string, value: string) => void backing.set(key, value),
        }) as unknown as Storage
    )
    store.set(localFlagKey('m', 'k', 2), 'completed')
    assert.deepEqual([...backing.entries()], [['rumbos.welcome.flow.m.k.2', 'completed']])
  })

  it('toStepInfo carries no viewer data', () => {
    const info = toStepInfo({
      type: 'quiz',
      key: 'quiz00001',
      title: 'Q',
      mandatory: true,
      revision: 1,
      cmid: 5,
      intro: null,
      outcomeAbove: null,
      outcomeBelow: null,
    })
    assert.deepEqual(Object.keys(info).sort(), [
      'allowFallback',
      'key',
      'mandatory',
      'minSeconds',
      'needsAck',
      'revision',
      'type',
    ])
  })
})
