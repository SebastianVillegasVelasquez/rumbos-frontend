import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  HTML_STEP_IFRAME_SANDBOX,
  buildHtmlStepDocument,
  hardenLinks,
  htmlStepCsp,
  htmlStepFrameAttributes,
} from './htmlStepDocument.ts'

const origin = 'https://api.example.org'

describe('the sandbox of an html step', () => {
  it('is exactly popups, and never scripts, same-origin, forms or top navigation', () => {
    assert.equal(HTML_STEP_IFRAME_SANDBOX, 'allow-popups allow-popups-to-escape-sandbox')
    const tokens = HTML_STEP_IFRAME_SANDBOX.split(' ')
    for (const forbidden of [
      'allow-scripts',
      'allow-same-origin',
      'allow-forms',
      'allow-top-navigation',
      'allow-top-navigation-by-user-activation',
      'allow-modals',
      'allow-downloads',
    ])
      assert.ok(!tokens.includes(forbidden), forbidden)
  })
})

describe('the policy of an html step', () => {
  it('blocks everything except inline style, data images and the assets origin', () => {
    const csp = htmlStepCsp(origin)
    assert.match(csp, /default-src 'none'/)
    assert.match(csp, /script-src 'none'/)
    assert.match(csp, /style-src 'unsafe-inline'/)
    assert.match(csp, /img-src data: https:\/\/api\.example\.org(;|$)/)
    for (const directive of ['connect-src', 'frame-src', 'object-src', 'form-action', 'base-uri'])
      assert.match(csp, new RegExp(`${directive} 'none'`))
    assert.ok(!csp.includes('unsafe-eval'))
    assert.ok(!/script-src[^;]*unsafe-inline/.test(csp))
  })
  it('an unsafe origin never reaches the policy', () => {
    for (const bad of ['javascript:alert(1)', "https://a.com; script-src 'unsafe-inline'", '', '*'])
      assert.match(htmlStepCsp(bad), /img-src data:(;|$)/, bad)
    assert.ok(!htmlStepCsp("https://a.com; script-src 'unsafe-inline'").includes('a.com'))
  })
})

describe('the document of an html step', () => {
  it('starts with the policy, before anything of the author', () => {
    const doc = buildHtmlStepDocument({ html: '<p>x</p>', css: 'p{color:red}', origin })
    assert.ok(
      doc.startsWith(
        '<!doctype html><html lang="es"><head><meta http-equiv="Content-Security-Policy"'
      )
    )
    assert.ok(doc.indexOf('Content-Security-Policy') < doc.indexOf('<p>x</p>'))
    assert.ok(doc.indexOf('Content-Security-Policy') < doc.indexOf('p{color:red}'))
  })
  it('has no script of its own and no runtime', () => {
    const doc = buildHtmlStepDocument({ html: '<p>x</p>', css: null, origin })
    assert.ok(!/<script/i.test(doc))
    assert.ok(!doc.includes('postMessage'))
    assert.ok(!doc.includes('rumbos'))
  })
  it('the base stylesheet comes first and the author css after it', () => {
    const doc = buildHtmlStepDocument({ html: '', css: 'h1{color:red}', origin })
    assert.ok(doc.indexOf('font:18px') < doc.indexOf('h1{color:red}'))
  })
  it('author css cannot close the style element', () => {
    const doc = buildHtmlStepDocument({
      html: '',
      css: 'a{} </style><img src=x onerror=alert(1)> <style>',
      origin,
    })
    assert.equal((doc.match(/<\/style>/g) ?? []).length, 2, 'the base and the author blocks only')
    assert.ok(!doc.includes('</style><img'))
  })
  it('links open in a new tab, apart from this page, and the first attribute wins', () => {
    assert.equal(
      hardenLinks('<a href="https://x.org">x</a><A HREF="https://y.org">y</A>'),
      '<a target="_blank" rel="noopener noreferrer" href="https://x.org">x</a><a target="_blank" rel="noopener noreferrer" HREF="https://y.org">y</A>'
    )
    assert.equal(
      hardenLinks('<abbr title="a">x</abbr><article>y</article>'),
      '<abbr title="a">x</abbr><article>y</article>'
    )
    assert.match(
      hardenLinks('<a\nhref="https://x.org">x</a>'),
      /^<a target="_blank" rel="noopener noreferrer"\nhref/
    )
  })
  it('the frame carries the sandbox, the policy and no referrer', () => {
    const attributes = htmlStepFrameAttributes({ html: '<p>x</p>', css: null, origin })
    assert.equal(attributes.sandbox, HTML_STEP_IFRAME_SANDBOX)
    assert.equal(attributes.csp, htmlStepCsp(origin))
    assert.equal(attributes.referrerPolicy, 'no-referrer')
    assert.ok(attributes.srcDoc.includes('<p>x</p>'))
  })
})
