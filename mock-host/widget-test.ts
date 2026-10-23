// Dev-only harness for docs/WIDGET-SANDBOX.md: puts mock-host/hostile-widget.html
// in the same sandbox students get and checks that each attack failed.
import {
  parseWidgetMessage,
  widgetFrameAttributes,
} from '../src/features/content/widget/sandbox.ts'

const $ = (id: string) => document.getElementById(id)!

// Secrets the widget must never read, and a way to tell if it navigated us.
localStorage.setItem('secret', 'hostsecret')
document.cookie = 'sess=hostsecret; path=/'
const startedAt = location.href
let navigated = false
window.addEventListener('beforeunload', () => {
  navigated = true
})

interface Result {
  test: string
  escaped: boolean
  detail: string
}

const EXPECTED = [
  'read parent DOM',
  'localStorage',
  'document.cookie',
  'fetch',
  'XHR',
  'navigate top',
  'window.open',
  'form submit',
  'third-party script',
  'third-party image',
  'postMessage flood',
]

const run = async () => {
  const html = await fetch('./hostile-widget.html').then((response) => response.text())
  const attributes = widgetFrameAttributes(html, location.origin)
  const frame = document.createElement('iframe')
  frame.title = 'hostile widget'
  // ?loosen adds allow-same-origin on purpose: a negative control that proves
  // this harness reports an escape when there is one.
  const loosen = new URLSearchParams(location.search).has('loosen')
  frame.setAttribute(
    'sandbox',
    loosen ? `${attributes.sandbox} allow-same-origin` : attributes.sandbox
  )
  frame.srcdoc = attributes.srcDoc
  frame.referrerPolicy = attributes.referrerPolicy
  $('frame').append(frame)

  let accepted = 0
  let ignored = 0
  let longestTaskMs = 0
  const frameReport: { results: Result[]; violations: string[] } = { results: [], violations: [] }

  window.addEventListener('message', (event) => {
    const started = performance.now()
    const data = event.data as { hostile?: boolean; results?: Result[]; violations?: string[] }
    if (data && data.hostile && event.source === frame.contentWindow) {
      frameReport.results = data.results ?? []
      frameReport.violations = data.violations ?? []
    } else if (parseWidgetMessage(event, frame.contentWindow)) accepted++
    else ignored++
    longestTaskMs = Math.max(longestTaskMs, performance.now() - started)
  })

  await new Promise((resolve) => setTimeout(resolve, 6000))

  const results = frameReport.results
  const table = $('results') as HTMLTableElement
  table.innerHTML = '<tr><th>attack</th><th>outcome</th><th>detail</th></tr>'
  let failures = 0
  for (const test of EXPECTED) {
    const found = results.filter((item) => item.test === test)
    // Passes only when the widget reported and every report says it did not escape.
    const escaped = found.some((item) => item.escaped)
    const reported = found.length > 0
    const ok = reported && !escaped
    if (!ok) failures++
    const row = table.insertRow()
    row.insertCell().textContent = test
    const cell = row.insertCell()
    cell.textContent = !reported ? 'NO REPORT' : escaped ? 'ESCAPED' : 'blocked'
    cell.className = ok ? 'pass' : 'fail'
    row.insertCell().textContent = found.map((item) => item.detail).join(' | ')
  }

  const stayed = location.href === startedAt && !navigated
  if (!stayed) failures++
  $('meta').textContent =
    `top window still here: ${stayed} · messages accepted: ${accepted}, ignored: ${ignored} · ` +
    `slowest handler: ${longestTaskMs.toFixed(1)} ms · CSP violations seen in the frame: ` +
    `${frameReport.violations.length} · sandbox="${frame.getAttribute('sandbox')}" · ` +
    `userAgent: ${navigator.userAgent}`
  $('verdict').textContent =
    failures === 0 ? 'PASS: every attack failed' : `FAIL: ${failures} problem(s)`
  $('verdict').className = failures === 0 ? 'pass' : 'fail'
  ;(window as unknown as { __sandboxVerdict: unknown }).__sandboxVerdict = {
    failures,
    accepted,
    ignored,
    longestTaskMs,
    stayed,
    violations: frameReport.violations,
  }
}

void run()
