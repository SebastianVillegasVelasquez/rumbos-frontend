import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { clearHostStats, getHostStats, setHostStatsResult } from '../embed/hostStats.ts'
import { parseHostMessage } from '../embed/protocol.ts'
import { buildHeatRows, computeInsights } from './insights.ts'
import { createStatsController } from './statsController.ts'

// The completion counts are aggregates about students. They live in memory for
// as long as the heat map is on, and nowhere else: not the backend, not browser
// storage, not logs, not error reports. These tests fail if that changes.

const SRC = join(import.meta.dirname, '..', '..')

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : []
  })

const rel = (path: string) => relative(SRC, path).split(sep).join('/')

const files = sourceFiles(SRC)
const statsCode = files.filter(
  (path) => rel(path).startsWith('features/heatmap/') || rel(path) === 'features/embed/hostStats.ts'
)

describe('stats code is isolated (static)', () => {
  assert.ok(statsCode.length >= 4, 'the stats code was not found')

  const forbidden: [RegExp, string][] = [
    [/\bfetch\s*\(/, 'fetch'],
    [/XMLHttpRequest/, 'XMLHttpRequest'],
    [/sendBeacon/, 'sendBeacon'],
    [/WebSocket|EventSource/, 'a socket'],
    [/localStorage|sessionStorage|indexedDB|document\.cookie/, 'browser storage'],
    [/\bconsole\s*\./, 'the console'],
    [/@tanstack\/react-query|useQuery|useMutation|queryClient/, 'the query cache'],
    [/course-map\/data\/|\.\.\/data\/|viewerStorage/, 'the data layer or viewer storage'],
    [/rumbos:error|reportToHost|escalation|hostReports|errorReason/, 'error reporting'],
    [/history\.(push|replace)State|location\.(href|search|hash)/, 'the URL'],
  ]

  for (const path of statsCode)
    it(`${rel(path)} reaches no network, storage, log or report`, () => {
      // Comments may talk about storage; only code can touch it.
      const code = readFileSync(path, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      for (const [pattern, what] of forbidden)
        assert.equal(pattern.test(code), false, `${rel(path)} touches ${what}`)
    })

  it('only the session, the app shell and the heat map itself import the stats', () => {
    const allowed = new Set([
      'features/embed/session.ts',
      'features/embed/EmbedRoot.tsx',
      // Draws a rate and a label, never counts.
      'features/course-map/components/HeatOverlay.tsx',
      'App.tsx',
    ])
    const importers = files
      .filter((path) => !statsCode.includes(path))
      .filter((path) =>
        /from '[^']*(hostStats|heatmap\/)[^']*'|import\('[^']*heatmap\/[^']*'\)/.test(
          readFileSync(path, 'utf8')
        )
      )
      .map(rel)
    for (const importer of importers) assert.ok(allowed.has(importer), `${importer} reads stats`)
  })

  it('the only stats message that leaves the app is the request, with no numbers', () => {
    const protocol = readFileSync(join(SRC, 'features/embed/protocol.ts'), 'utf8')
    const outgoing = protocol.slice(protocol.indexOf('export type AppMessage'))
    const block = outgoing.slice(0, outgoing.indexOf('export type NoContentReason'))
    assert.match(block, /rumbos:request-stats'; v: 1; groupId\?: number/)
    assert.equal(/complete|failed|tracked/.test(block.split('request-stats')[1] ?? ''), false)
  })
})

describe('stats never leave memory (runtime)', () => {
  const calls: string[] = []
  const saved: Record<string, unknown> = {}
  const names = ['fetch', 'XMLHttpRequest', 'localStorage', 'sessionStorage', 'indexedDB'] as const
  const logMethods = ['log', 'info', 'warn', 'error', 'debug'] as const
  const realConsole: Record<string, unknown> = {}

  const trap = (what: string) =>
    new Proxy(function () {}, {
      apply: () => {
        calls.push(what)
      },
      construct: () => {
        calls.push(what)
        return {}
      },
      get: (_t, prop) => {
        calls.push(`${what}.${String(prop)}`)
        return () => undefined
      },
    })

  beforeEach(() => {
    calls.length = 0
    const target = globalThis as unknown as Record<string, unknown>
    for (const name of names) {
      saved[name] = target[name]
      Object.defineProperty(globalThis, name, {
        value: trap(name),
        configurable: true,
        writable: true,
      })
    }
    for (const method of logMethods) {
      realConsole[method] = console[method]
      console[method] = (() => calls.push(`console.${method}`)) as never
    }
  })

  afterEach(() => {
    for (const name of names)
      Object.defineProperty(globalThis, name, {
        value: saved[name],
        configurable: true,
        writable: true,
      })
    for (const method of logMethods) console[method] = realConsole[method] as never
    clearHostStats()
  })

  const SENTINEL = 7_654_321
  const wire = {
    type: 'rumbos:host-stats',
    v: 1,
    stats: {
      schemaVersion: 1,
      generatedAt: '2026-01-01T00:00:00Z',
      courseId: 7,
      groupId: 0,
      groups: [{ id: 1, name: 'A' }],
      tracked: SENTINEL,
      minCohort: 5,
      suppressed: false,
      activities: [{ cmid: 1, completionTracked: true, complete: SENTINEL - 1, failed: 1 }],
    },
  }

  it('parsing, storing, computing and refreshing touch no network, storage or log', () => {
    const sent: unknown[] = []
    const controller = createStatsController({
      send: (groupId) => sent.push({ type: 'rumbos:request-stats', v: 1, groupId }),
      schedule: () => () => undefined,
    })
    controller.request()
    const message = parseHostMessage(wire)
    assert.ok(message && message.type === 'rumbos:host-stats')
    if (message.type !== 'rumbos:host-stats') return
    setHostStatsResult(message)
    const state = getHostStats()
    assert.equal(state.status, 'ready')
    if (state.status === 'ready') {
      const rows = buildHeatRows([{ bubbleId: 'b', cmid: 1, name: 'A', sequence: 1 }], state.stats)
      computeInsights(rows)
    }
    controller.refresh()
    assert.deepEqual(calls, [])
    // What goes to the host is a request, never numbers.
    assert.equal(JSON.stringify(sent).includes(String(SENTINEL)), false)
  })

  it('turning the heat map off drops the numbers', () => {
    const controller = createStatsController({
      send: () => undefined,
      schedule: () => () => undefined,
    })
    controller.request()
    const message = parseHostMessage(wire)
    if (message?.type === 'rumbos:host-stats') setHostStatsResult(message)
    assert.equal(JSON.stringify(getHostStats()).includes(String(SENTINEL)), true)
    controller.stop()
    assert.deepEqual(getHostStats(), { status: 'idle' })
    assert.equal(JSON.stringify(getHostStats()).includes(String(SENTINEL)), false)
  })

  it('a malformed answer is dropped without a trace in the log', () => {
    parseHostMessage({ ...wire, stats: { ...wire.stats, tracked: -1 } })
    assert.deepEqual(calls, [])
  })
})

describe('stats are dropped when the app is unloaded', () => {
  it('the heat map controller listens for pagehide and stops', () => {
    const code = readFileSync(join(SRC, 'features/heatmap/useHeatmap.ts'), 'utf8')
    assert.match(code, /addEventListener\('pagehide'/)
    assert.match(code, /controller\.stop\(\)/)
  })
})
