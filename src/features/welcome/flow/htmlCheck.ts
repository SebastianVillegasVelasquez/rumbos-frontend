// A client-side mirror of the backend's HTML and CSS rules for flow steps, so the
// editor can point at a problem before saving. It is a convenience, NOT the
// security boundary: the backend validates, and what students get is rendered in
// a sandboxed iframe without scripts under a strict CSP (see htmlStepDocument).
// ASSUMPTIONS where the brief is silent: `href` on `a`, `src` on `img` are allowed
// (they are what the tags are for); a data image may weigh at most 20 KB; images
// from Rumbos assets are paths under /assets/.

export const ALLOWED_TAGS: ReadonlySet<string> = new Set(
  (
    'p br hr div span section article header footer main aside h1 h2 h3 h4 h5 h6 ul ol li dl dt dd ' +
    'strong em b i u s small mark sub sup blockquote q cite code pre abbr table caption thead tbody ' +
    'tfoot tr th td colgroup col figure figcaption img a details summary'
  ).split(' ')
)

const ALLOWED_ATTRIBUTES: ReadonlySet<string> = new Set(
  'class id title lang dir role alt width height colspan rowspan scope start reversed open'.split(
    ' '
  )
)

const VOID_TAGS = new Set(['br', 'hr', 'img', 'col'])
export const MAX_DATA_IMAGE_BYTES = 20 * 1024
const DATA_IMAGE = /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]*$/i
const ASSET_PATH = /^\/assets\/[0-9a-f-]{36}(\/thumb)?$/i

export type HtmlIssue =
  | { reason: 'tag'; tag: string }
  | { reason: 'attribute'; tag: string; attribute: string }
  | { reason: 'link'; tag: string }
  | { reason: 'image'; tag: string }
  | { reason: 'malformed' }

const isSafeLink = (value: string): boolean => {
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' && !url.username && !url.password
  } catch {
    return false
  }
}

const isSafeImage = (value: string): boolean => {
  const src = value.trim()
  if (DATA_IMAGE.test(src)) return (src.length * 3) / 4 <= MAX_DATA_IMAGE_BYTES
  return ASSET_PATH.test(src)
}

interface ParsedAttribute {
  name: string
  value: string
}

// name, name=value, name="value", name='value'.
const ATTRIBUTE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g

const parseAttributes = (source: string): ParsedAttribute[] => {
  const attributes: ParsedAttribute[] = []
  for (const match of source.matchAll(ATTRIBUTE))
    attributes.push({
      name: match[1].toLowerCase(),
      value: match[2] ?? match[3] ?? match[4] ?? '',
    })
  return attributes
}

// The first thing in the markup the contract does not allow, or null.
export const findHtmlIssue = (html: string): HtmlIssue | null => {
  let index = 0
  while (index < html.length) {
    const open = html.indexOf('<', index)
    if (open < 0) return null
    if (html.startsWith('<!--', open)) {
      const close = html.indexOf('-->', open + 4)
      if (close < 0) return { reason: 'malformed' }
      index = close + 3
      continue
    }
    // `<!doctype`, `<?xml`, `<![CDATA[`: none are allowed in a fragment.
    if (html[open + 1] === '!' || html[open + 1] === '?') return { reason: 'tag', tag: '!' }
    const next = html[open + 1]
    if (next !== '/' && !/[a-zA-Z]/.test(next ?? '')) {
      // A lone `<` in text; the parser treats it as text, and so do we.
      index = open + 1
      continue
    }
    // A tag ends at the first `>` outside quotes.
    let cursor = open + 1
    let quote: string | null = null
    for (; cursor < html.length; cursor++) {
      const char = html[cursor]
      if (quote) {
        if (char === quote) quote = null
      } else if (char === '"' || char === "'") quote = char
      else if (char === '>') break
    }
    if (cursor >= html.length) return { reason: 'malformed' }
    const body = html.slice(open + 1, cursor)
    index = cursor + 1
    const closing = body.startsWith('/')
    const nameMatch = /^\/?\s*([a-zA-Z][a-zA-Z0-9-]*)/.exec(body)
    if (!nameMatch) return { reason: 'malformed' }
    const tag = nameMatch[1].toLowerCase()
    if (!ALLOWED_TAGS.has(tag)) return { reason: 'tag', tag }
    if (closing) continue
    const rest = body.slice(nameMatch[0].length).replace(/\/\s*$/, '')
    for (const { name, value } of parseAttributes(rest)) {
      const isHref = tag === 'a' && name === 'href'
      const isSrc = tag === 'img' && name === 'src'
      if (isHref) {
        if (!isSafeLink(value)) return { reason: 'link', tag }
      } else if (isSrc) {
        if (!isSafeImage(value)) return { reason: 'image', tag }
      } else if (
        !ALLOWED_ATTRIBUTES.has(name) &&
        !(name.startsWith('aria-') && /^aria-[a-z-]+$/.test(name))
      )
        return { reason: 'attribute', tag, attribute: name }
    }
    if (VOID_TAGS.has(tag)) continue
  }
  return null
}

export type CssIssue = 'import' | 'external_url' | 'expression' | 'behavior' | 'escape'

// The first thing in the stylesheet the contract does not allow, or null. `url()`
// may only carry a small data image or a Rumbos asset path. A backslash is
// refused outright: CSS escapes can spell any keyword and a mirror cannot tell.
export const findCssIssue = (css: string): CssIssue | null => {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, ' ')
  if (text.includes('\\')) return 'escape'
  if (/@import\b/i.test(text)) return 'import'
  if (/expression\s*\(/i.test(text)) return 'expression'
  if (/behaviou?r\s*:|-moz-binding/i.test(text)) return 'behavior'
  for (const match of text.matchAll(/url\s*\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi)) {
    const target = (match[1] ?? match[2] ?? match[3] ?? '').trim()
    if (!(DATA_IMAGE.test(target) || ASSET_PATH.test(target))) return 'external_url'
  }
  // `url(` that did not match the pattern above (unbalanced) is refused too.
  if (
    (text.match(/url\s*\(/gi) ?? []).length !==
    [...text.matchAll(/url\s*\(\s*(?:"[^"]*"|'[^']*'|[^)]*)\s*\)/gi)].length
  )
    return 'external_url'
  return null
}
