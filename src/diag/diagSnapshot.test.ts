import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { browserOf, diagRows, type DiagEnv } from './diagSnapshot.ts'

describe('browserOf', () => {
  const cases: Array<[string, string, string, string]> = [
    [
      'Safari on a Mac',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
      'Safari',
      '17.4',
    ],
    [
      'Chrome on a Mac',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36',
      'Chrome',
      '155.0.0.0',
    ],
    [
      'Edge',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 Edg/150.0.2000.1',
      'Edge',
      '150.0.2000.1',
    ],
    [
      'Firefox',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:140.0) Gecko/20100101 Firefox/140.0',
      'Firefox',
      '140.0',
    ],
    [
      'Chrome on iOS',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/150.0.0.0 Mobile/15E148 Safari/604.1',
      'Chrome',
      '150.0.0.0',
    ],
    ['nothing known', 'curl/8.0', 'Desconocido', ''],
  ]
  for (const [name, ua, browser, version] of cases)
    it(name, () => assert.deepEqual(browserOf(ua), { name: browser, version }))
})

const env = (over: Partial<DiagEnv> = {}): DiagEnv => ({
  innerWidth: 1100,
  innerHeight: 300,
  devicePixelRatio: 2,
  embedded: true,
  userAgent: 'Mozilla/5.0 Version/17.4 Safari/605.1.15',
  supports: { aspectRatio: true, dvh: true, containerQueries: true, has: false },
  panel: { width: 281, height: 158 },
  panelParent: { height: 326, computedHeight: '326px' },
  videoFrame: { width: 281, height: 158 },
  videoLoad: 'loaded',
  lastError: null,
  ...over,
})

describe('diagRows', () => {
  const value = (rows: Array<[string, string]>, label: string) =>
    rows.find(([name]) => name === label)?.[1]

  it('shows every figure the screenshot is for', () => {
    const rows = diagRows(env())
    assert.equal(value(rows, 'Navegador'), 'Safari 17.4')
    assert.equal(value(rows, 'Ventana'), '1100 x 300')
    assert.equal(value(rows, 'Densidad de píxeles'), '2')
    assert.equal(value(rows, 'Panel del video'), '281 x 158 (proporción 1.78)')
    assert.equal(value(rows, 'Alto del contenedor del panel'), '326 px (326px)')
    assert.equal(value(rows, 'Marco del video'), '281 x 158')
    assert.equal(value(rows, 'Carga del video'), 'loaded')
    assert.equal(value(rows, 'Soporta :has()'), 'No')
    assert.equal(value(rows, 'Soporta dvh'), 'Sí')
    assert.equal(value(rows, 'Último error'), 'Ninguno')
  })

  it('says so when there is no video, no frame or an error', () => {
    const rows = diagRows(
      env({
        panel: null,
        panelParent: null,
        videoFrame: null,
        videoLoad: null,
        embedded: false,
        lastError: 'boom',
      })
    )
    assert.equal(value(rows, 'Panel del video'), 'Ninguno')
    assert.equal(value(rows, 'Carga del video'), 'Ninguno')
    assert.match(value(rows, 'Marco de Rumbos') ?? '', /sin marco/)
    assert.equal(value(rows, 'Último error'), 'boom')
  })
})

// The panel is read-only by construction: its sources never reach for the
// network, storage or another window.
describe('the diagnostic panel stays read-only', () => {
  const FORBIDDEN =
    /\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|EventSource|postMessage|localStorage|sessionStorage|indexedDB|new Image)\b/
  const dir = import.meta.dirname
  const sources = readdirSync(dir).filter(
    (name) => /\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts')
  )
  it('has sources to check', () => assert.ok(sources.length >= 4))
  for (const name of sources)
    it(`${name} makes no request and stores nothing`, () => {
      const code = readFileSync(join(dir, name), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      assert.doesNotMatch(code, FORBIDDEN)
    })
})
