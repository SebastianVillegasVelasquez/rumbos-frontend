// The one place that decides how an author-written widget runs. Everything the
// sandbox allows or forbids is spelled out here and pinned by sandbox.test.ts,
// so a refactor cannot loosen it without a test failing. See
// docs/WIDGET-SANDBOX.md.

// `allow-scripts` and nothing else. Notably absent: allow-same-origin (the
// frame keeps an opaque origin, so it cannot read the app's DOM, storage or
// cookies), allow-forms, allow-popups, allow-top-navigation, allow-modals and
// allow-downloads.
export const WIDGET_IFRAME_SANDBOX = 'allow-scripts'

export const WIDGET_MAX_HEIGHT_PX = 1600
export const WIDGET_MIN_HEIGHT_PX = 120
export const WIDGET_DEFAULT_HEIGHT_PX = 320

// A frame with an opaque origin cannot resolve a relative URL, and a CSP source
// needs an origin: the assets origin is absolute or it is the app's own.
export const assetsOrigin = (apiBaseUrl: string, pageOrigin: string): string => {
  try {
    return new URL(apiBaseUrl, pageOrigin).origin
  } catch {
    return pageOrigin
  }
}

// The origin must be a plain http(s) origin; anything else would let a value
// smuggle another directive into the policy.
const SAFE_ORIGIN = /^https?:\/\/[A-Za-z0-9.-]+(:\d{1,5})?$/

export const widgetCsp = (origin: string): string => {
  const assets = SAFE_ORIGIN.test(origin) ? origin : ''
  const sources = (base: string) => (assets ? `${base} ${assets}` : base)
  return [
    "default-src 'none'",
    "script-src 'unsafe-inline'",
    "style-src 'unsafe-inline'",
    `img-src ${sources('data: blob:')}`,
    `media-src ${sources('data: blob:')}`,
    'font-src data:',
    "connect-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
  ].join('; ')
}

const escapeAttribute = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// The runtime the wrapper offers the widget. It is a message to the parent and
// nothing else: no credentials, no references to the app.
const RUNTIME = `<script>
window.rumbos = {
  close: function () { parent.postMessage({ source: 'rumbos-widget', type: 'close' }, '*') },
  setHeight: function (px) { parent.postMessage({ source: 'rumbos-widget', type: 'setHeight', height: Number(px) }, '*') }
}
</script>`

// The complete srcdoc. The CSP meta is the first element of the document, so it
// governs everything that follows, the author's markup included.
export const buildWidgetDocument = (html: string, origin: string): string =>
  `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${escapeAttribute(widgetCsp(origin))}">${RUNTIME}</head><body>${html}</body></html>`

export interface WidgetFrameAttributes {
  sandbox: string
  srcDoc: string
  referrerPolicy: 'no-referrer'
}

export const widgetFrameAttributes = (html: string, origin: string): WidgetFrameAttributes => ({
  sandbox: WIDGET_IFRAME_SANDBOX,
  srcDoc: buildWidgetDocument(html, origin),
  referrerPolicy: 'no-referrer',
})

export type WidgetMessage = { type: 'close' } | { type: 'setHeight'; height: number }

// Every message from the frame is untrusted. It counts only if it comes from the
// frame's own window and has exactly the expected shape; anything else is
// ignored, however large or malformed.
export const parseWidgetMessage = (
  event: { source: unknown; data: unknown },
  frameWindow: unknown
): WidgetMessage | null => {
  if (frameWindow === null || frameWindow === undefined || event.source !== frameWindow) return null
  const data = event.data
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null
  const record = data as Record<string, unknown>
  if (record.source !== 'rumbos-widget') return null
  if (record.type === 'close') return Object.keys(record).length === 2 ? { type: 'close' } : null
  if (record.type === 'setHeight') {
    if (Object.keys(record).length !== 3) return null
    const height = record.height
    if (typeof height !== 'number' || !Number.isFinite(height)) return null
    return {
      type: 'setHeight',
      height: Math.min(WIDGET_MAX_HEIGHT_PX, Math.max(WIDGET_MIN_HEIGHT_PX, Math.round(height))),
    }
  }
  return null
}
