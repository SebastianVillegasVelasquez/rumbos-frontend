import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  WIDGET_IFRAME_SANDBOX,
  assetsOrigin,
  buildWidgetDocument,
  parseWidgetMessage,
  widgetCsp,
  widgetFrameAttributes,
} from './sandbox.ts'

const ORIGIN = 'https://api.example.org'

// The policy students get, written out in full on purpose: if this string has
// to change, a person reads the diff.
const EXPECTED_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; " +
  'img-src data: blob: https://api.example.org; media-src data: blob: https://api.example.org; ' +
  "font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'"

describe('widget sandbox', () => {
  it('sandboxes with allow-scripts and nothing else', () => {
    assert.equal(WIDGET_IFRAME_SANDBOX, 'allow-scripts')
    const attributes = widgetFrameAttributes('<p>x</p>', ORIGIN)
    assert.equal(attributes.sandbox, 'allow-scripts')
    for (const forbidden of [
      'allow-same-origin',
      'allow-forms',
      'allow-popups',
      'allow-top-navigation',
      'allow-modals',
      'allow-downloads',
      'allow-popups-to-escape-sandbox',
      'allow-presentation',
    ])
      assert.ok(!attributes.sandbox.includes(forbidden), forbidden)
    assert.equal(attributes.referrerPolicy, 'no-referrer')
  })

  it('pins the content security policy', () => {
    assert.equal(widgetCsp(ORIGIN), EXPECTED_CSP)
  })

  it('puts the policy first in the document', () => {
    const doc = buildWidgetDocument('<p>hola</p>', ORIGIN)
    assert.ok(
      doc.startsWith(
        `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${EXPECTED_CSP}">`
      )
    )
    assert.ok(doc.includes('<p>hola</p>'))
    assert.equal(doc.indexOf('Content-Security-Policy') < doc.indexOf('<p>hola</p>'), true)
    assert.equal(doc.indexOf('Content-Security-Policy') < doc.indexOf('<script>'), true)
  })

  it('never lets an odd origin add directives', () => {
    const csp = widgetCsp("https://a.org; script-src *; x='")
    assert.ok(!csp.includes('script-src *'))
    assert.ok(csp.includes('img-src data: blob:;'))
  })

  it('derives the assets origin from the API base', () => {
    assert.equal(assetsOrigin('/api/v1', 'https://app.example.org'), 'https://app.example.org')
    assert.equal(assetsOrigin('https://api.example.org/api/v1', 'https://app.example.org'), ORIGIN)
  })
})

describe('parseWidgetMessage', () => {
  const frame = {}
  const message = (data: unknown, source: unknown = frame) =>
    parseWidgetMessage({ source, data }, frame)

  it('accepts close and a clamped setHeight from the frame', () => {
    assert.deepEqual(message({ source: 'rumbos-widget', type: 'close' }), { type: 'close' })
    assert.deepEqual(message({ source: 'rumbos-widget', type: 'setHeight', height: 500 }), {
      type: 'setHeight',
      height: 500,
    })
    assert.deepEqual(message({ source: 'rumbos-widget', type: 'setHeight', height: 1e9 }), {
      type: 'setHeight',
      height: 1600,
    })
    assert.deepEqual(message({ source: 'rumbos-widget', type: 'setHeight', height: -5 }), {
      type: 'setHeight',
      height: 120,
    })
  })

  it('ignores other windows, other shapes and anything oversized or malformed', () => {
    assert.equal(message({ source: 'rumbos-widget', type: 'close' }, {}), null)
    assert.equal(message({ source: 'rumbos-widget', type: 'close' }, null), null)
    for (const data of [
      null,
      'close',
      [],
      { type: 'close' },
      { source: 'rumbos-widget', type: 'close', extra: 'x'.repeat(1_000_000) },
      { source: 'rumbos-widget', type: 'setHeight' },
      { source: 'rumbos-widget', type: 'setHeight', height: '500' },
      { source: 'rumbos-widget', type: 'setHeight', height: Number.NaN },
      { source: 'rumbos-widget', type: 'setHeight', height: Infinity },
      { source: 'rumbos-widget', type: 'navigate', url: 'https://evil.example' },
    ])
      assert.equal(message(data), null)
  })

  it('ignores everything while there is no frame', () => {
    assert.equal(
      parseWidgetMessage(
        { source: undefined, data: { source: 'rumbos-widget', type: 'close' } },
        undefined
      ),
      null
    )
  })
})
