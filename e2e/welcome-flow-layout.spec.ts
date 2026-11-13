import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { app, routeProvider, setFrameSize } from './support.ts'
import { giveMapsMusic, stubMedia } from './audioStub.ts'

// Layout robustness of the welcome flow: at the windows a course gives it and at
// larger text, with a very long title, no step may scroll the window sideways,
// let the card outgrow the window or push the primary action out of reach. The
// card scrolls inside itself; its header and footer stay put.

const LONG_TITLE =
  'Bienvenido al programa de formación integral en gestión de proyectos de innovación social'

const head = {
  enabled: true,
  title: null,
  message: null,
  video: null,
  playOnEnter: true,
  show: 'first_visit',
}
const steps = [
  {
    type: 'welcome',
    key: 'welcome001',
    title: LONG_TITLE,
    mandatory: true,
    revision: 1,
    message: 'Antes de empezar, conoce cómo funciona este curso y qué te espera en el recorrido.',
    buttonLabel: null,
  },
  {
    type: 'video',
    key: 'video00001',
    title: LONG_TITLE,
    mandatory: false,
    revision: 1,
    video: { provider: 'youtube', videoId: 'jNQXAC9IVRw' },
    allowFallback: true,
  },
  {
    type: 'html',
    key: 'html00001',
    title: 'Reglas',
    mandatory: false,
    revision: 1,
    html: '<h2>Reglas</h2><p>Sé amable.</p>',
    css: null,
    ack: { label: 'Leí y acepto las reglas del curso y del programa completo' },
    minSeconds: 0,
  },
  {
    type: 'pdf',
    key: 'pdf000001',
    title: 'Reglamento',
    mandatory: false,
    revision: 1,
    assetId: '00000000-0000-4000-8000-0000000000d0',
    ack: null,
    minSeconds: 0,
  },
  {
    type: 'quiz',
    key: 'quiz00001',
    title: 'Evaluación de entrada',
    mandatory: false,
    revision: 1,
    cmid: 101,
    intro: 'Responde la evaluación para medir tu punto de partida.',
    outcomeAbove: null,
    outcomeBelow: null,
  },
]
const flow = { ...head, steps }

const open = async (page: Page, context: BrowserContext, size: readonly number[], zoom: number) => {
  await stubMedia(context)
  await routeProvider(context, 'small')
  await context.route(/\/assets\/[0-9a-f-]{36}$/, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><body>Documento</body>' })
  )
  await page.goto('/mock-host/index.html')
  const input = page.locator('label:has-text("app URL") input')
  const current = await input.inputValue()
  await input.fill(
    `${current.split('?')[0]}?mockWelcomeJson=${encodeURIComponent(JSON.stringify(flow))}`
  )
  await page.getByRole('button', { name: '(Re)load app' }).click()
  await setFrameSize(page, size[0], size[1])
  const level = app(page).getByRole('button', { name: /^1/ }).first()
  await level.waitFor({ timeout: 8000 })
  await giveMapsMusic(page)
  await level.click()
  await app(page).getByRole('dialog', { name: 'Bienvenida', exact: true }).waitFor()
  // Larger text: the browser's text zoom scales the root font size.
  if (zoom !== 1)
    await app(page)
      .locator('body')
      .evaluate((_, value) => {
        document.documentElement.style.fontSize = `${value * 100}%`
      }, zoom)
}

const dialog = (page: Page) => app(page).getByRole('dialog', { name: 'Bienvenida', exact: true })
const next = (page: Page) =>
  dialog(page).getByRole('button', { name: /^(Continuar|Terminar|Empezar viaje)$/ })

const measure = (page: Page) =>
  app(page)
    .locator('body')
    .evaluate(() => {
      // The dialog is not measured: its blurred backdrop is scaled past its edges
      // on purpose and clipped (overflow hidden), so its scrollWidth always exceeds it.
      // Measure the resting layout: the step entrance (a 16 px slide) is finished.
      for (const animation of document.getAnimations())
        if ((animation as CSSAnimation).animationName === 'flow-step-in') animation.finish()
      const scroller = document.querySelector<HTMLElement>('.flow-card-scroll')!
      const card = document.querySelector<HTMLElement>('.flow-card')!
      const foot = card.querySelector<HTMLElement>('footer')!
      const primary = [...foot.querySelectorAll('button')].filter((b) =>
        /^(Continuar|Terminar|Empezar viaje)/.test((b.textContent ?? '').trim())
      )[0]
      const r = primary.getBoundingClientRect()
      const c = card.getBoundingClientRect()
      return {
        sideways: {
          document: document.documentElement.scrollWidth - innerWidth,
          scroller: scroller.scrollWidth - scroller.clientWidth,
          card: card.scrollWidth - card.clientWidth,
        },
        cardOver: c.height - innerHeight,
        cardLeft: c.left,
        cardRight: innerWidth - c.right,
        primary: { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height },
        vw: innerWidth,
        vh: innerHeight,
      }
    })

const SIZES: ReadonlyArray<readonly [number, number, number]> = [
  [320, 640, 1], // 400% browser zoom of a 1280 window
  [360, 640, 1],
  [412, 915, 1],
  [768, 1024, 1],
  [640, 360, 1], // a phone in landscape
  [915, 412, 1],
  [1280, 720, 1],
  [1366, 768, 1],
  [1920, 1080, 1],
  [360, 640, 1.3],
  [360, 640, 2],
  [1366, 768, 1.3],
  [1366, 768, 2],
  [640, 360, 2],
]

for (const [width, height, zoom] of SIZES) {
  test(`${width}x${height} at ${Math.round(zoom * 100)}% text: nothing overflows and the primary action is reachable`, async ({
    page,
    context,
  }) => {
    await open(page, context, [width, height], zoom)
    for (let index = 0; index < steps.length; index++) {
      await dialog(page).locator('h1').waitFor()
      await page.waitForTimeout(300)
      const m = await measure(page)
      const where = `step ${index + 1} at ${width}x${height} ${zoom}x`
      expect(JSON.stringify(m.sideways), `${where}: sideways scroll`).toBe(
        JSON.stringify({ document: 0, scroller: 0, card: 0 })
      )
      expect(m.cardOver, `${where}: card taller than the window`).toBeLessThanOrEqual(1)
      expect(m.cardLeft, `${where}: card clipped on the left`).toBeGreaterThanOrEqual(0)
      expect(m.cardRight, `${where}: card clipped on the right`).toBeGreaterThanOrEqual(0)
      expect(m.primary.top, `${where}: primary above the window`).toBeGreaterThanOrEqual(0)
      expect(m.primary.bottom, `${where}: primary below the window`).toBeLessThanOrEqual(m.vh + 1)
      expect(m.primary.right, `${where}: primary clipped`).toBeLessThanOrEqual(m.vw + 1)
      expect(m.primary.height, `${where}: primary too small`).toBeGreaterThanOrEqual(43.5)
      if (index < steps.length - 1) await next(page).click()
    }
  })
}
