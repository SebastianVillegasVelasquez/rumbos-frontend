import { es } from '../i18n/es.ts'

// The rows of the ?diag=1 panel. Pure: everything it shows comes in as `env`,
// so it can be tested, and so it has no way to send anything anywhere.

const text = es.diag

export interface Box {
  width: number
  height: number
}

export interface DiagEnv {
  innerWidth: number
  innerHeight: number
  devicePixelRatio: number
  embedded: boolean
  userAgent: string
  supports: {
    aspectRatio: boolean
    dvh: boolean
    containerQueries: boolean
    has: boolean
  }
  // Null when there is no welcome video on screen.
  panel: Box | null
  panelParent: { height: number; computedHeight: string } | null
  videoFrame: Box | null
  // 'loading' | 'loaded' | 'failed' as the curtain tracks it, null when none.
  videoLoad: string | null
  lastError: string | null
}

export interface DiagBrowser {
  name: string
  version: string
}

const PATTERNS: Array<[string, RegExp]> = [
  ['Edge', /\bEdg(?:e|A|iOS)?\/(\d+(?:\.\d+)*)/],
  ['Opera', /\bOPR\/(\d+(?:\.\d+)*)/],
  ['Firefox', /\b(?:Firefox|FxiOS)\/(\d+(?:\.\d+)*)/],
  ['Chrome', /\b(?:Chrome|CriOS)\/(\d+(?:\.\d+)*)/],
  ['Safari', /\bVersion\/(\d+(?:\.\d+)*).*\bSafari\//],
]

// Browser name and version from the user agent. Order matters: Chrome and
// Edge both say Safari, Edge also says Chrome.
export const browserOf = (userAgent: string): DiagBrowser => {
  for (const [name, pattern] of PATTERNS) {
    const match = pattern.exec(userAgent)
    if (match) return { name, version: match[1] }
  }
  return { name: text.unknown, version: '' }
}

const size = (box: Box) => `${Math.round(box.width)} x ${Math.round(box.height)}`
const yesNo = (value: boolean) => (value ? text.yes : text.no)

export const diagRows = (env: DiagEnv): Array<[string, string]> => {
  const browser = browserOf(env.userAgent)
  const rows: Array<[string, string]> = [
    [text.browser, `${browser.name} ${browser.version}`.trim()],
    [text.window, `${env.innerWidth} x ${env.innerHeight}`],
    [text.pixelRatio, String(env.devicePixelRatio)],
    [
      text.rumbosFrame,
      `${env.innerWidth} x ${env.innerHeight}${env.embedded ? '' : text.notEmbedded}`,
    ],
    [
      text.panel,
      env.panel
        ? `${size(env.panel)} (${text.ratio} ${(env.panel.width / Math.max(env.panel.height, 1)).toFixed(2)})`
        : text.none,
    ],
    [
      text.panelParent,
      env.panelParent
        ? `${Math.round(env.panelParent.height)} px (${env.panelParent.computedHeight})`
        : text.none,
    ],
    [text.videoFrame, env.videoFrame ? size(env.videoFrame) : text.none],
    [text.videoLoad, env.videoLoad ?? text.none],
    [text.aspectRatio, yesNo(env.supports.aspectRatio)],
    [text.dvh, yesNo(env.supports.dvh)],
    [text.containerQueries, yesNo(env.supports.containerQueries)],
    [text.has, yesNo(env.supports.has)],
    [text.lastError, env.lastError ?? text.none],
  ]
  return rows
}
