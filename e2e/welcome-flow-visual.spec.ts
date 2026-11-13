import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { app, routeProvider, setFrameSize } from './support.ts'
import { giveMapsMusic, stubMedia } from './audioStub.ts'

// Visual baselines of the welcome flow: the five step types at three window
// sizes, in both engines. Layout only (see docs/E2E.md): the mock host, the mock
// backend and a stubbed provider and media element, so nothing depends on the
// network. Steps 2 to 5 are optional here only so the test can walk to them; the
// waiting (mandatory) look has its own baselines.

const SIZES = [
  [1366, 768],
  [768, 1024],
  [412, 915],
] as const

const SEED_DOCUMENT = '00000000-0000-4000-8000-0000000000d0'

const head = {
  enabled: true,
  title: null,
  message: null,
  video: null,
  playOnEnter: true,
  show: 'first_visit',
}
const welcomeStep = {
  type: 'welcome',
  key: 'welcome001',
  title: 'Bienvenido a {curso}',
  mandatory: true,
  revision: 1,
  message: 'Antes de empezar, conoce cómo funciona este curso y qué te espera en el recorrido.',
  buttonLabel: null,
}
const videoStep = (mandatory: boolean) => ({
  type: 'video',
  key: 'video00001',
  title: 'Mira cómo empezar',
  mandatory,
  revision: 1,
  video: { provider: 'youtube', videoId: 'jNQXAC9IVRw' },
  allowFallback: true,
})
const htmlStep = (mandatory: boolean) => ({
  type: 'html',
  key: 'html00001',
  title: 'Reglas del curso',
  mandatory,
  revision: 1,
  html: '<h2>Reglas</h2><p>Sé amable y puntual. Pregunta cuando tengas dudas.</p>',
  css: null,
  ack: { label: 'Leí y acepto las reglas' },
  minSeconds: 0,
})
const pdfStep = {
  type: 'pdf',
  key: 'pdf000001',
  title: 'Reglamento',
  mandatory: false,
  revision: 1,
  assetId: SEED_DOCUMENT,
  ack: null,
  minSeconds: 0,
}
const quizStep = (mandatory: boolean) => ({
  type: 'quiz',
  key: 'quiz00001',
  title: 'Evaluación de entrada',
  mandatory,
  revision: 1,
  cmid: 101,
  intro: 'Responde la evaluación para medir tu punto de partida.',
  outcomeAbove: 'Muy bien.',
  outcomeBelow: null,
})
const flowOf = (...steps: object[]) => ({ ...head, steps })
const walk = flowOf(welcomeStep, videoStep(false), htmlStep(false), pdfStep, quizStep(false))

const open = async (
  page: Page,
  context: BrowserContext,
  welcome: object,
  size: readonly number[]
) => {
  await stubMedia(context)
  await routeProvider(context, 'small')
  // A stand-in for the document so the viewer does not depend on a PDF plugin.
  await context.route(/\/assets\/[0-9a-f-]{36}$/, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><body style="margin:0;background:#eee;font:16px system-ui;padding:24px">Documento</body>',
    })
  )
  await page.goto('/mock-host/index.html')
  const input = page.locator('label:has-text("app URL") input')
  const current = await input.inputValue()
  await input.fill(
    `${current.split('?')[0]}?mockWelcomeJson=${encodeURIComponent(JSON.stringify(welcome))}`
  )
  await page.getByRole('button', { name: '(Re)load app' }).click()
  await setFrameSize(page, size[0], size[1])
  const level = app(page).getByRole('button', { name: /^1/ }).first()
  await level.waitFor({ timeout: 8000 })
  await giveMapsMusic(page)
  await level.click()
  await app(page).getByRole('dialog', { name: 'Bienvenida', exact: true }).waitFor()
}

const dialog = (page: Page) => app(page).getByRole('dialog', { name: 'Bienvenida', exact: true })
const next = (page: Page) =>
  dialog(page).getByRole('button', { name: /^(Continuar|Terminar|Empezar viaje)$/ })

const shot = async (page: Page, name: string) => {
  // Let the entrance animation and the fonts settle: the frame is the picture.
  await page.waitForTimeout(500)
  await expect(page.locator('#frame-wrap')).toHaveScreenshot(`${name}.png`, {
    animations: 'disabled',
    maxDiffPixelRatio: 0.03,
  })
}

for (const [width, height] of SIZES) {
  test.describe(`flow visuals ${width}x${height}`, () => {
    test('the five steps', async ({ page, context }) => {
      await open(page, context, walk, [width, height])
      await shot(page, `1-welcome-${width}`)

      await next(page).click()
      await dialog(page).getByRole('button', { name: 'Reproducir video' }).waitFor()
      await shot(page, `2-video-${width}`)

      await next(page).click()
      await dialog(page).getByRole('heading', { name: 'Reglas del curso' }).waitFor()
      await shot(page, `3-html-${width}`)

      await next(page).click()
      await dialog(page).getByRole('heading', { name: 'Reglamento' }).waitFor()
      await shot(page, `4-pdf-${width}`)

      await next(page).click()
      await dialog(page).getByRole('heading', { name: 'Evaluación de entrada' }).waitFor()
      await shot(page, `5-quiz-${width}`)
    })
  })
}

test.describe('flow visuals: the waiting state', () => {
  test('a mandatory video and a mandatory quiz say what they wait for', async ({
    page,
    context,
  }) => {
    await open(page, context, flowOf(welcomeStep, videoStep(true), quizStep(true)), [1366, 768])
    await next(page).click()
    await expect(dialog(page).getByText('Termina el video para continuar.')).toBeVisible()
    await shot(page, 'waiting-video-1366')
  })

  test('going back keeps the label and the highlighted segment on the same step', async ({
    page,
    context,
  }) => {
    await open(page, context, walk, [1366, 768])
    await next(page).click()
    await dialog(page).getByRole('button', { name: 'Atrás' }).click()
    await expect(dialog(page).getByText('Paso 1 de 5 · Bienvenida', { exact: true })).toBeVisible()
    await expect(dialog(page).locator('.flow-seg[data-kind="current"]')).toHaveCount(1)
    await expect(dialog(page).locator('.flow-seg[data-kind="current"]')).toHaveAttribute(
      'aria-label',
      /Paso 1:/
    )
    await expect(dialog(page).locator('.flow-seg[data-kind="visited"]')).toHaveCount(1)
  })
})
