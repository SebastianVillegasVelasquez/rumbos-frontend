import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DEFAULT_WELCOME } from '../welcome.ts'
import type { MapWelcome, WelcomeStep } from '../../course-map/data/types.ts'
import {
  LEGACY_VIDEO_KEY,
  LEGACY_WELCOME_KEY,
  convertLegacyToSteps,
  deriveLegacySteps,
  effectiveSteps,
  newStepKey,
  validateFlow,
} from './flowSteps.ts'
import { findCssIssue, findHtmlIssue } from './htmlCheck.ts'

const labels = { welcomeTitle: 'Bienvenida', videoTitle: 'Video de bienvenida' }
const video = { provider: 'youtube' as const, videoId: 'dQw4w9WgXcQ' }

const html = (extra: Partial<Extract<WelcomeStep, { type: 'html' }>> = {}): WelcomeStep => ({
  type: 'html',
  key: 'rulesabc1',
  title: 'Reglas',
  mandatory: true,
  revision: 1,
  html: '<p>Hola</p>',
  css: null,
  ack: null,
  minSeconds: 0,
  ...extra,
})
const flow = (steps: WelcomeStep[]): MapWelcome => ({ ...DEFAULT_WELCOME, steps })
const welcomeStep = (key: string): WelcomeStep => ({
  type: 'welcome',
  key,
  title: 'W',
  mandatory: true,
  revision: 1,
  message: null,
  buttonLabel: null,
})
const quizStep = (key: string): WelcomeStep => ({
  type: 'quiz',
  key,
  title: 'Q',
  mandatory: true,
  revision: 1,
  cmid: null,
  intro: null,
  outcomeAbove: null,
  outcomeBelow: null,
})

describe('legacy derivation', () => {
  it('a message only: one welcome step with a fixed key and the same text', () => {
    const steps = deriveLegacySteps(
      { ...DEFAULT_WELCOME, title: 'Hola {curso}', message: 'Texto' },
      labels
    )
    assert.deepEqual(steps, [
      {
        type: 'welcome',
        key: LEGACY_WELCOME_KEY,
        title: 'Hola {curso}',
        mandatory: true,
        revision: 1,
        message: 'Texto',
        buttonLabel: null,
      },
    ])
  })
  it('a video adds a NON mandatory video step: the old curtain never forced it', () => {
    const steps = deriveLegacySteps({ ...DEFAULT_WELCOME, video }, labels)
    assert.deepEqual(
      steps.map((step) => [step.type, step.key, step.mandatory]),
      [
        ['welcome', LEGACY_WELCOME_KEY, true],
        ['video', LEGACY_VIDEO_KEY, false],
      ]
    )
    assert.equal(steps[0].title, 'Bienvenida')
  })
  it('derived keys satisfy the contract and the derivation is stable', () => {
    const welcome = { ...DEFAULT_WELCOME, video }
    for (const step of deriveLegacySteps(welcome, labels))
      assert.match(step.key, /^[a-z0-9]{6,16}$/)
    assert.deepEqual(deriveLegacySteps(welcome, labels), deriveLegacySteps(welcome, labels))
    assert.deepEqual(validateFlow(convertLegacyToSteps(welcome, labels)), [])
  })
  it('a long legacy title is cut to the step limit', () => {
    const [step] = deriveLegacySteps({ ...DEFAULT_WELCOME, title: 'x'.repeat(120) }, labels)
    assert.ok(step.title.length <= 120)
  })
  it('conversion clears the legacy fields and keeps enabled and show', () => {
    const out = convertLegacyToSteps(
      { ...DEFAULT_WELCOME, title: 'T', message: 'M', video, show: 'always', enabled: false },
      labels
    )
    assert.equal(out.title, null)
    assert.equal(out.message, null)
    assert.equal(out.video, null)
    assert.equal(out.show, 'always')
    assert.equal(out.enabled, false)
  })
  it('effectiveSteps prefers configured steps over the derivation', () => {
    const own = [html()]
    assert.equal(effectiveSteps(flow(own), labels), own)
    for (const steps of [[], null] as (WelcomeStep[] | null)[])
      assert.equal(effectiveSteps({ ...DEFAULT_WELCOME, steps }, labels)[0].key, LEGACY_WELCOME_KEY)
  })
})

describe('step keys', () => {
  it('match the contract and avoid the keys already taken', () => {
    let calls = 0
    const key = newStepKey(['aaaaaaaaaa'], () => (calls++ < 10 ? 0 : 0.99))
    assert.match(key, /^[a-z0-9]{6,16}$/)
    assert.notEqual(key, 'aaaaaaaaaa')
  })
  it('the default random source gives valid keys', () => {
    assert.match(newStepKey([]), /^[a-z0-9]{6,16}$/)
  })
})

describe('flow validation mirrors the backend codes', () => {
  const codes = (welcome: MapWelcome) => validateFlow(welcome).map((problem) => problem.code)
  it('a valid flow has no problems', () => assert.deepEqual(validateFlow(flow([html()])), []))
  it('no steps: nothing to check', () => assert.deepEqual(validateFlow({ ...DEFAULT_WELCOME }), []))
  it('legacy fields with steps', () =>
    assert.deepEqual(codes({ ...flow([html()]), message: 'x' }), ['legacy_fields_with_steps']))
  it('more than 12 steps', () => {
    const many = Array.from({ length: 13 }, (_, i) =>
      html({ key: `step${String(i).padStart(4, '0')}` })
    )
    assert.ok(codes(flow(many)).includes('steps_too_many'))
  })
  it('duplicate keys, with the path of the second', () => {
    assert.deepEqual(validateFlow(flow([html(), html()])), [
      { path: 'steps[1].key', code: 'step_key_duplicate' },
    ])
  })
  it('a welcome step must be the only one and first', () => {
    assert.deepEqual(codes(flow([welcomeStep('welcome01'), html()])), [])
    assert.deepEqual(codes(flow([html(), welcomeStep('welcome01')])), ['welcome_step_position'])
    assert.ok(
      codes(flow([welcomeStep('welcome01'), welcomeStep('welcome02')])).includes(
        'welcome_step_position'
      )
    )
  })
  it('an unknown step type', () => {
    const odd = { ...html(), type: 'game' } as unknown as WelcomeStep
    assert.deepEqual(validateFlow(flow([odd])), [
      { path: 'steps[0].type', code: 'step_type_invalid' },
    ])
  })
  it('more than three quizzes', () => {
    const three = ['quizaaaa1', 'quizaaaa2', 'quizaaaa3'].map(quizStep)
    assert.deepEqual(codes(flow(three)), [])
    assert.deepEqual(codes(flow([...three, quizStep('quizaaaa4')])), ['quiz_too_many'])
  })
  it('video ids, key shape, titles and limits', () => {
    const bad: WelcomeStep = {
      type: 'video',
      key: 'BAD',
      title: '',
      mandatory: true,
      revision: 1,
      video: { provider: 'youtube', videoId: 'no' },
      allowFallback: true,
    }
    assert.deepEqual(codes(flow([bad])).sort(), [
      'step_key_invalid',
      'step_title_invalid',
      'video_invalid',
    ])
    assert.deepEqual(codes(flow([html({ minSeconds: 601 })])), ['step_field_invalid'])
    assert.deepEqual(codes(flow([html({ html: 'a'.repeat(100 * 1024 + 1) })])), ['flow_too_large'])
    assert.deepEqual(codes(flow([html({ css: 'a'.repeat(50 * 1024 + 1) })])), ['flow_too_large'])
  })
  it('documents the server cannot serve', () => {
    const pdf: WelcomeStep = {
      type: 'pdf',
      key: 'pdfaaaaa1',
      title: 'Doc',
      mandatory: true,
      revision: 1,
      assetId: 'x',
      ack: null,
      minSeconds: 0,
    }
    assert.deepEqual(validateFlow(flow([pdf]), { availableDocuments: new Set(['x']) }), [])
    assert.deepEqual(validateFlow(flow([pdf]), { availableDocuments: new Set() }), [
      { path: 'steps[0].assetId', code: 'document_unavailable' },
    ])
  })
  it('forbidden markup and css are pointed at their field', () => {
    assert.deepEqual(validateFlow(flow([html({ html: '<script>1</script>' })])), [
      { path: 'steps[0].html', code: 'html_forbidden_markup' },
    ])
    assert.deepEqual(validateFlow(flow([html({ css: '@import "x";' })])), [
      { path: 'steps[0].css', code: 'css_forbidden' },
    ])
  })
})

describe('html rules', () => {
  const bad = (markup: string) => findHtmlIssue(markup) !== null
  it('allows the listed tags and attributes', () => {
    assert.equal(
      findHtmlIssue(
        '<section class="a" id="b" lang="es"><h1>T</h1><p aria-label="x">a <strong>b</strong><br/></p><table><tr><td colspan="2">c</td></tr></table></section>'
      ),
      null
    )
    assert.equal(findHtmlIssue('<a href="https://example.org/x">enlace</a>'), null)
    assert.equal(findHtmlIssue('a < b and 3 <4'), null)
    assert.equal(findHtmlIssue('<!-- nota --><p>x</p>'), null)
  })
  it('refuses scripts, styles, forms, frames, svg and unknown tags', () => {
    const tags = ['script', 'style', 'form', 'iframe', 'svg', 'object', 'embed', 'link']
    for (const tag of [...tags, 'meta', 'base', 'input', 'button', 'video'])
      assert.ok(bad(`<${tag}>x</${tag}>`), tag)
  })
  it('refuses inline style, event handlers and data attributes, in any case', () => {
    assert.ok(bad('<p style="color:red">x</p>'))
    assert.ok(bad('<p onclick="x()">x</p>'))
    assert.ok(bad('<p ONCLICK=x>x</p>'))
    assert.ok(bad('<p data-x="1">x</p>'))
    assert.ok(bad('<p class="a"onmouseover="x">x</p>'))
  })
  it('links are https only, without credentials', () => {
    const hrefs = ['http://a.org', 'javascript:alert(1)', ' JaVaScRiPt:x', 'data:text/html,x']
    for (const href of [...hrefs, '//a.org', '/x', 'https://u:p@a.org'])
      assert.ok(bad(`<a href="${href}">x</a>`), href)
    assert.ok(!bad('<a>x</a>'))
    assert.ok(bad('<a href="https://a.org" target="_blank">x</a>'), 'target is not allowed')
  })
  it('images are Rumbos assets or small data images only', () => {
    const asset = '/assets/123e4567-e89b-12d3-a456-426614174000'
    assert.equal(findHtmlIssue(`<img src="${asset}" alt="a">`), null)
    assert.equal(findHtmlIssue('<img src="data:image/png;base64,iVBORw0KGgo=" alt="a">'), null)
    assert.ok(bad('<img src="https://evil.example/x.png" alt="a">'))
    assert.ok(bad('<img src="data:image/svg+xml;base64,AAAA" alt="a">'))
    assert.ok(bad(`<img src="data:image/png;base64,${'A'.repeat(30_000)}" alt="a">`))
  })
  it('a > inside a quoted attribute does not end the tag early', () => {
    assert.equal(findHtmlIssue('<p title="a>b">x</p>'), null)
    assert.ok(bad('<p title="a>b" onclick="x">x</p>'))
  })
  it('malformed markup is refused rather than guessed at', () => {
    assert.ok(bad('<p'))
    assert.ok(bad('<!-- sin cerrar'))
    assert.ok(bad('<!DOCTYPE html><p>x</p>'))
  })
})

describe('css rules', () => {
  it('allows ordinary styles and small data or asset urls', () => {
    assert.equal(findCssIssue('p { color: #123; margin: 1em } .a::before { content: "x" }'), null)
    assert.equal(findCssIssue('.a { background: url(data:image/png;base64,AAAA) }'), null)
    assert.equal(
      findCssIssue('.a { background: url("/assets/123e4567-e89b-12d3-a456-426614174000") }'),
      null
    )
  })
  it('refuses imports, external urls, expressions, behaviors and escapes', () => {
    assert.equal(findCssIssue('@import url(x.css);'), 'import')
    assert.equal(findCssIssue('@IMPORT "x";'), 'import')
    assert.equal(findCssIssue('.a { background: url(https://evil.example/x) }'), 'external_url')
    assert.equal(findCssIssue('.a { background: url(//evil.example/x) }'), 'external_url')
    assert.equal(findCssIssue('.a { width: expression(alert(1)) }'), 'expression')
    assert.equal(findCssIssue('.a { behavior: url(x.htc) }'), 'behavior')
    assert.equal(findCssIssue('.a { -moz-binding: x }'), 'behavior')
    assert.equal(findCssIssue('@\\69mport "x";'), 'escape')
  })
  it('a comment does not hide a rule, and does not create one', () => {
    assert.equal(findCssIssue('@im/**/port "x"'), null, 'a comment splits the keyword: harmless')
    assert.equal(findCssIssue('/* @import "x" */ p{}'), null)
    assert.equal(findCssIssue('.a{background:url(http://x'), 'external_url')
  })
})
