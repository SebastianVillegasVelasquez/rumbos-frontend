import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { app } from './support.ts'
import { stubMedia } from './audioStub.ts'

// The closing flow offers the welcome flow's content steps: video, PDF, text and the final
// exam, in the editor and in the student's player. Against the mock host and the draft
// closing shape of the mock API (branch-local: contracts/openapi.json does not declare the
// closing flow's step types, so nothing here is sent to a backend). Chromium and WebKit.

const SEED_DOCUMENT = '00000000-0000-4000-8000-0000000000d0'

const closing = {
  enabled: true,
  title: null,
  message: null,
  video: null,
  playOnEnter: null,
  show: 'always',
  steps: [
    {
      type: 'video',
      key: 'closevideo1',
      title: 'Mensaje de cierre',
      mandatory: true,
      revision: 1,
      video: { provider: 'youtube', videoId: 'jNQXAC9IVRw' },
      allowFallback: true,
    },
    {
      type: 'pdf',
      key: 'closepdf001',
      title: 'Tu certificado',
      mandatory: true,
      revision: 1,
      assetId: SEED_DOCUMENT,
      ack: null,
      minSeconds: 0,
    },
    {
      type: 'html',
      key: 'closehtml1',
      title: 'Lo que lograste',
      mandatory: true,
      revision: 1,
      html: '<h2>Lo que lograste</h2><p>Terminaste el nivel.</p>',
      css: null,
      ack: { label: 'Leí lo que lograste' },
      minSeconds: 0,
    },
    {
      type: 'assessment',
      key: 'closefinal1',
      title: 'Evaluación final',
      mandatory: true,
      revision: 1,
      purpose: 'final',
    },
  ],
}

// The provider's player stand-in: it plays, then ends (what YouTube posts).
const PLAYER = `
  const post = (o) => parent.postMessage(JSON.stringify(o), '*')
  post({ event: 'onReady', info: null })
  post({ event: 'onStateChange', info: 1 })
  setTimeout(() => post({ event: 'onStateChange', info: 0 }), 600)`

const stubProviderAndDocument = async (context: BrowserContext) => {
  await stubMedia(context)
  await context.route('https://www.youtube-nocookie.com/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><body style="margin:0;background:#222"><script>${PLAYER}</script>`,
    })
  )
  await context.route(/\/assets\/[0-9a-f-]{36}$/, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><body style="margin:0;background:#eee;font:16px system-ui;padding:24px">Documento</body>',
    })
  )
}

const load = async (page: Page, query: string) => {
  const input = page.locator('label:has-text("app URL") input')
  const current = await input.inputValue()
  await input.fill(`${current.split('?')[0]}?mockStableIds=1${query}`)
  await page.getByRole('button', { name: '(Re)load app' }).click()
  const level = app(page).getByRole('button', { name: /^1/ }).first()
  await level.waitFor({ timeout: 8000 })
  return level
}

const asJson = (value: object) => `&mockClosingJson=${encodeURIComponent(JSON.stringify(value))}`
const dialog = (page: Page) => app(page).getByRole('dialog', { name: 'Cierre', exact: true })
const next = (page: Page) => dialog(page).getByRole('button', { name: /^(Continuar|Terminar)$/ })

test.describe('closing flow: the student', () => {
  test('walks video, PDF and text with the welcome flow gates, then reaches the final exam', async ({
    page,
    context,
  }) => {
    await stubProviderAndDocument(context)
    await page.goto('/mock-host/index.html')
    const level = await load(page, `&mockWelcome=disabled&mockClosing=available${asJson(closing)}`)
    await level.click()
    const bubble = app(page).getByRole('dialog', { name: 'Bienvenida al curso' })
    await bubble.waitFor({ timeout: 8000 })
    await bubble.getByRole('button', { name: 'Cerrar' }).first().click()
    await app(page).getByRole('button', { name: 'Omitir' }).click()
    await expect(app(page).getByRole('dialog')).toHaveCount(0)

    await app(page).getByRole('button', { name: 'Cierre', exact: true }).click()
    await expect(dialog(page)).toBeVisible()

    // Video: the mandatory step waits for the end, as in the welcome flow.
    await expect(dialog(page).getByRole('heading', { name: 'Mensaje de cierre' })).toBeVisible()
    await expect(next(page)).toHaveAttribute('aria-disabled', 'true')
    await dialog(page)
      .getByRole('button', { name: /Reproducir/ })
      .click()
    await expect(next(page)).toHaveAttribute('aria-disabled', 'false', { timeout: 10_000 })
    await next(page).click()

    // PDF.
    await expect(dialog(page).getByRole('heading', { name: 'Tu certificado' })).toBeVisible()
    await expect(next(page)).toHaveAttribute('aria-disabled', 'false')
    await next(page).click()

    // Text with an acknowledgement: it waits for the checkbox.
    await expect(dialog(page).getByRole('heading', { name: 'Lo que lograste' })).toBeVisible()
    await expect(next(page)).toHaveAttribute('aria-disabled', 'true')
    await dialog(page).getByRole('checkbox', { name: 'Leí lo que lograste' }).check()
    await expect(next(page)).toHaveAttribute('aria-disabled', 'false')
    await next(page).click()

    // The final exam is the last step (this mock does not serve the exam list).
    await expect(dialog(page).getByRole('heading', { name: 'Evaluación final' })).toBeVisible()
    await expect(
      dialog(page)
        .getByText(/^Paso 4 de 4/)
        .first()
    ).toBeVisible()
  })
})

test.describe('closing flow: the editor', () => {
  test('adds every content type, reorders with the keyboard and previews', async ({
    page,
    context,
  }) => {
    await stubProviderAndDocument(context)
    await page.goto('/mock-host/index.html')
    await page.locator('label:has-text("role") select').selectOption('editor')
    await page.locator('label:has-text("editing on") input').check()
    const level = await load(page, asJson({ ...closing, steps: [] }))
    await level.click()
    await app(page)
      .getByRole('button', { name: /^Apariencia/ })
      .first()
      .click()
    await app(page).getByRole('button', { name: 'Cierre', exact: true }).first().click()

    const tab = app(page)
    const list = tab.locator('ol[aria-label="Flujo de cierre"] > li')
    // The menu is the welcome flow's, without the greeting.
    for (const name of ['Video', 'Texto con formato', 'Documento PDF', 'Evaluación final'])
      await expect(tab.getByRole('button', { name, exact: true })).toBeVisible()
    await expect(tab.getByRole('button', { name: 'Mensaje de bienvenida' })).toHaveCount(0)
    await expect(tab.getByRole('button', { name: 'Evaluación de Moodle' })).toHaveCount(0)

    await tab.getByRole('button', { name: 'Video', exact: true }).click()
    await tab.getByRole('button', { name: 'Texto con formato', exact: true }).click()
    await tab.getByRole('button', { name: 'Documento PDF', exact: true }).click()
    await tab.getByRole('button', { name: 'Evaluación final', exact: true }).click()
    await expect(list).toHaveCount(4)

    // The same validation messages as the welcome flow: the new video has no link yet.
    await expect(
      tab.getByRole('status').filter({ hasText: 'Hay 2 problemas por corregir antes de guardar.' })
    ).toBeVisible()

    // Keyboard reordering: the PDF goes up one place with Enter on its button.
    const up = tab.getByRole('button', { name: /^Subir paso: Documento/ })
    await up.focus()
    await page.keyboard.press('Enter')
    await expect(list.nth(1)).toContainText('Documento')
    await expect(list.nth(2)).toContainText('Texto')

    // Probar el flujo previews the closing flow, saving nothing.
    await tab.getByRole('button', { name: 'Probar el flujo' }).click()
    await expect(dialog(page)).toBeVisible()
    await expect(dialog(page).getByText('Vista previa: no se guarda nada.')).toBeVisible()
    await expect(dialog(page).getByText('Paso 1 de 4 · Video')).toBeVisible()
    await dialog(page).getByRole('button', { name: 'Saltar vista previa' }).click()
    await expect(dialog(page)).toHaveCount(0)
  })
})
