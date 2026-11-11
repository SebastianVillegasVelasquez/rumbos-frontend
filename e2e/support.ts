import type { BrowserContext, FrameLocator, Page } from '@playwright/test'

// The viewports of the audit matrix (CSS px) and the zoom levels. A browser at
// zoom z shows the app a viewport of size / z CSS px, so a zoom is a smaller
// viewport here; device pixel ratio does not change CSS layout.
export const VIEWPORTS: ReadonlyArray<readonly [number, number]> = [
  [1024, 600],
  [1280, 650],
  [1280, 720],
  [1440, 800],
  [1512, 860],
  [1728, 1000],
  [768, 1024],
  [360, 640],
]
export const ZOOMS = [1, 1.25, 1.5] as const

// The heights a Moodle course can give the Rumbos iframe (fixed 500/600/700),
// plus the shortest ones the site minimum (200-1000 px) and a phone in
// landscape allow.
export const MOODLE_CELLS: ReadonlyArray<readonly [number, number]> = [
  [1100, 500],
  [1100, 600],
  [1100, 700],
  [667, 375],
  [1100, 300],
  [1100, 200],
]

export const MIN_W = 280
export const MIN_H = 158
export const RATIO = 16 / 9
export const RATIO_TOLERANCE = 0.02

export type Surrogate = 'small' | 'tall' | 'blocked'

const PROVIDER = 'https://www.youtube-nocookie.com/**'

// A stand-in for the provider's player page, answered at the provider's own
// origin so the curtain's origin checks stay real.
const SURROGATE_HTML: Record<Exclude<Surrogate, 'blocked'>, string> = {
  // Intrinsic size 300x150, like an iframe or a canvas with no CSS.
  small:
    '<!doctype html><body style="margin:0;background:#222"><canvas width="300" height="150"></canvas>',
  // Content that asks for a lot of height.
  tall: '<!doctype html><body style="margin:0;background:#222"><div style="height:2400px;color:#fff">tall</div>',
}

export const routeProvider = async (context: BrowserContext, mode: Surrogate) => {
  await context.route(PROVIDER, (route) =>
    mode === 'blocked'
      ? route.abort('blockedbyclient')
      : route.fulfill({ contentType: 'text/html', body: SURROGATE_HTML[mode] })
  )
}

export interface Probe {
  viewport: string
  panelW: number
  panelH: number
  iframeW: number
  iframeH: number
  parentH: number
  scrollH: number
  clientH: number
  flexShrink: string
  minHeight: string
  hasPanel: boolean
}

export const app = (page: Page): FrameLocator => page.frameLocator('#frame-wrap iframe')

export const openLevel = async (
  page: Page,
  welcome: 'video' | 'video-optional' = 'video',
  extraQuery = ''
) => {
  await page.goto('/mock-host/index.html')
  // The "app URL" field holds the iframe address; add the demo welcome to it.
  const input = page.locator('label:has-text("app URL") input')
  const current = await input.inputValue()
  await input.fill(`${current.split('?')[0]}?mockWelcome=${welcome}${extraQuery}`)
  await page.getByRole('button', { name: '(Re)load app' }).click()
  // The level cards are buttons whose text starts with the level number.
  await app(page).getByRole('button', { name: /^1/ }).first().click()
}

// Sizes the host's frame so the app's own viewport is exactly w x h.
export const setFrameSize = async (page: Page, w: number, h: number) => {
  await page.evaluate(
    ([width, height]) => {
      const wrap = document.querySelector<HTMLElement>('#frame-wrap')!
      wrap.style.maxWidth = 'none'
      wrap.style.minHeight = '0'
      wrap.style.width = `${width}px`
      wrap.style.height = `${height}px`
    },
    [w, h]
  )
  await page.waitForTimeout(150)
}

// Measures the video panel (the iframe's parent) and the iframe in the app.
export const probe = async (page: Page): Promise<Probe> => {
  const frame = page.frames().find((f) => f !== page.mainFrame() && f.url().includes('/embed'))!
  return frame.evaluate(() => {
    const dialog = document.querySelector('[role=dialog]')
    const iframe = dialog?.querySelector('iframe') ?? null
    const panel = iframe?.parentElement ?? null
    const scroller = dialog?.querySelector<HTMLElement>(':scope > div.relative') ?? null
    const rect = (el: Element | null | undefined) => el?.getBoundingClientRect()
    // The wrapper around the panel may be display: contents (no box of its own).
    let parent = panel?.parentElement ?? null
    while (parent && getComputedStyle(parent).display === 'contents') parent = parent.parentElement
    const style = panel ? getComputedStyle(panel) : null
    return {
      viewport: `${innerWidth}x${innerHeight}`,
      panelW: Math.round(rect(panel)?.width ?? 0),
      panelH: Math.round(rect(panel)?.height ?? 0),
      iframeW: Math.round(rect(iframe)?.width ?? 0),
      iframeH: Math.round(rect(iframe)?.height ?? 0),
      parentH: Math.round(rect(parent)?.height ?? 0),
      scrollH: scroller?.scrollHeight ?? 0,
      clientH: scroller?.clientHeight ?? 0,
      flexShrink: style?.flexShrink ?? '',
      minHeight: style?.minHeight ?? '',
      hasPanel: panel !== null,
    }
  })
}

// Why a measurement is not acceptable, or null.
export const problem = (p: Probe): string | null => {
  if (!p.hasPanel) return 'no video panel'
  const issues: string[] = []
  if (p.panelW < MIN_W || p.panelH < MIN_H) issues.push(`below ${MIN_W}x${MIN_H}`)
  const ratio = p.panelW / Math.max(p.panelH, 1)
  if (Math.abs(ratio - RATIO) / RATIO > RATIO_TOLERANCE) issues.push(`ratio ${ratio.toFixed(2)}`)
  if (p.iframeW < MIN_W || p.iframeH < MIN_H) issues.push('iframe below minimum')
  return issues.length ? issues.join(', ') : null
}

export const describeProbe = (p: Probe) =>
  `vp=${p.viewport} panel=${p.panelW}x${p.panelH} iframe=${p.iframeW}x${p.iframeH} parent=${p.parentH} ` +
  `scroll=${p.scrollH}/${p.clientH} flex-shrink=${p.flexShrink} min-h=${p.minHeight}`
