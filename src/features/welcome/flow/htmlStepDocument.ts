import { assetsOrigin } from '../../content/widget/sandbox.ts'

// How an HTML step of the welcome flow is rendered. It reuses the idea of the
// content widget sandbox (docs/WIDGET-SANDBOX.md) with scripts OFF and without the
// widget runtime (the frame has nothing to say to the app). This is the security
// boundary of the feature; the validation of the author's markup is a convenience
// on top of it. Pinned by htmlStepDocument.test.ts.

// No scripts, no same-origin (opaque origin: no access to the app, its storage or
// cookies), no forms, no top navigation, no modals, no downloads. Popups only so
// links open in a new tab; the popup is not sandboxed itself and is unrelated to
// the app (noopener).
export const HTML_STEP_IFRAME_SANDBOX = 'allow-popups allow-popups-to-escape-sandbox'

export { assetsOrigin }

const SAFE_ORIGIN = /^https?:\/\/[A-Za-z0-9.-]+(:\d{1,5})?$/

// Everything is blocked except inline style, data images and the assets origin.
export const htmlStepCsp = (origin: string): string => {
  const assets = SAFE_ORIGIN.test(origin) ? ` ${origin}` : ''
  return [
    "default-src 'none'",
    "script-src 'none'",
    "style-src 'unsafe-inline'",
    `img-src data:${assets}`,
    "font-src 'none'",
    "connect-src 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "media-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
  ].join('; ')
}

// Readable defaults (AA contrast, 18px base text, visible focus). The author's
// CSS comes after and may change any of it.
export const BASE_CSS = `
html{-webkit-text-size-adjust:100%}
body{margin:0;padding:16px;font:18px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#1b1b1f;background:#fff;overflow-wrap:anywhere}
h1,h2,h3,h4,h5,h6{line-height:1.25;margin:1.2em 0 .5em}
h1{font-size:1.6em}h2{font-size:1.35em}h3{font-size:1.15em}
p,ul,ol,dl,blockquote,pre,table,figure{margin:0 0 1em}
ul,ol{padding-left:1.4em}
a{color:#0b4fb3;text-decoration:underline}
a:focus-visible,summary:focus-visible{outline:3px solid #0b4fb3;outline-offset:2px}
img{max-width:100%;height:auto}
table{border-collapse:collapse;max-width:100%}
th,td{border:1px solid #6b6b76;padding:.4em .6em;text-align:left}
blockquote{margin-left:0;padding-left:1em;border-left:4px solid #6b6b76}
pre{white-space:pre-wrap;overflow-x:auto}
`

const escapeStyleEnd = (css: string) => css.replace(/<\/style/gi, '<\\/style')

// Every link opens in a new tab and keeps the new page apart from this one. Mine
// goes first: when an attribute repeats the browser keeps the first.
export const hardenLinks = (html: string): string =>
  html.replace(/<a(?=[\s>/])/gi, '<a target="_blank" rel="noopener noreferrer"')

export interface HtmlStepDocumentInput {
  html: string
  css: string | null
  lang?: string
  // The origin Rumbos assets are served from.
  origin: string
}

// The complete srcdoc. The CSP meta is the first element of the document, so it
// governs everything that follows, the author's markup included.
export const buildHtmlStepDocument = ({
  html,
  css,
  lang = 'es',
  origin,
}: HtmlStepDocumentInput): string =>
  `<!doctype html><html lang="${lang === 'es' ? 'es' : 'en'}"><head>` +
  `<meta http-equiv="Content-Security-Policy" content="${htmlStepCsp(origin).replace(/"/g, '&quot;')}">` +
  `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
  `<style>${BASE_CSS}</style>` +
  (css ? `<style>${escapeStyleEnd(css)}</style>` : '') +
  `</head><body>${hardenLinks(html)}</body></html>`

export interface HtmlStepFrameAttributes {
  sandbox: string
  srcDoc: string
  referrerPolicy: 'no-referrer'
  // Where supported: the browser enforces the policy on the frame itself, even
  // before it parses the meta tag.
  csp: string
}

export const htmlStepFrameAttributes = (input: HtmlStepDocumentInput): HtmlStepFrameAttributes => ({
  sandbox: HTML_STEP_IFRAME_SANDBOX,
  srcDoc: buildHtmlStepDocument(input),
  referrerPolicy: 'no-referrer',
  csp: htmlStepCsp(input.origin),
})
