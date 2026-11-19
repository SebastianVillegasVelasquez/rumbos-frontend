import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { app } from './support.ts'
import { stubMedia } from './audioStub.ts'

// Regression for "Continuar never unlocks after the welcome video". The provider's
// player page is answered at the provider's own origin, so the app's origin and
// source checks stay real; the page posts the same messages YouTube posts (checked
// against the real player in Chromium and WebKit: onReady, infoDelivery with
// playerState 1, then onStateChange 0 / infoDelivery playerState 0 at the end).

const flow = (allowFallback = true) => ({
  enabled: true,
  title: null,
  message: null,
  video: null,
  playOnEnter: true,
  show: 'first_visit',
  steps: [
    {
      type: 'video',
      key: 'video0001',
      title: 'Mira el video',
      mandatory: true,
      revision: 1,
      video: { provider: 'youtube', videoId: 'jNQXAC9IVRw' },
      allowFallback,
    },
  ],
})

// What the stand-in player page does, by scenario.
const PLAYER: Record<string, string> = {
  ends: `
    const post = (o) => parent.postMessage(JSON.stringify(o), '*')
    post({ event: 'onReady', info: null })
    post({ event: 'onStateChange', info: 1 })
    setTimeout(() => {
      post({ event: 'infoDelivery', info: { playerState: 0 } })
      post({ event: 'onStateChange', info: 0 })
    }, 600)`,
  // Plays but never reaches the end within the test (a looping video).
  loops: `
    const post = (o) => parent.postMessage(JSON.stringify(o), '*')
    post({ event: 'onReady', info: null })
    post({ event: 'onStateChange', info: 1 })`,
  // The page loads and says nothing: a blocked or broken player.
  silent: '',
  errors: `parent.postMessage(JSON.stringify({ event: 'onError', info: 150 }), '*')`,
}

const open = async (page: Page, context: BrowserContext, scenario: string, welcome: object) => {
  await stubMedia(context)
  await context.route('https://www.youtube-nocookie.com/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><body style="margin:0;background:#222"><script>${PLAYER[scenario]}</script>`,
    })
  )
  await page.goto('/mock-host/index.html')
  const input = page.locator('label:has-text("app URL") input')
  const current = await input.inputValue()
  await input.fill(
    `${current.split('?')[0]}?mockStableIds=1&mockWelcomeJson=${encodeURIComponent(JSON.stringify(welcome))}`
  )
  await page.getByRole('button', { name: '(Re)load app' }).click()
  const level = app(page).getByRole('button', { name: /^1/ }).first()
  await level
    .waitFor({ timeout: 5000 })
    .then(() => level.click())
    .catch(() => undefined)
}

const dialog = (page: Page) => app(page).getByRole('dialog', { name: 'Bienvenida', exact: true })
const next = (page: Page) =>
  dialog(page).getByRole('button', { name: /^(Continuar|Terminar|Empezar viaje)$/ })

test.describe('welcome video gate', () => {
  test('Continuar unlocks when the player says the video ended', async ({ page, context }) => {
    await open(page, context, 'ends', flow())
    await expect(next(page)).toHaveAttribute('aria-disabled', 'true')
    await dialog(page)
      .getByRole('button', { name: /Reproducir/ })
      .click()
    await expect(next(page)).toHaveAttribute('aria-disabled', 'false', { timeout: 10_000 })
  })

  test('a video that plays and does not end stays locked, with no escape offered', async ({
    page,
    context,
  }) => {
    await open(page, context, 'loops', flow())
    await dialog(page)
      .getByRole('button', { name: /Reproducir/ })
      .click()
    await page.waitForTimeout(1500)
    await expect(next(page)).toHaveAttribute('aria-disabled', 'true')
    await expect(dialog(page).getByRole('button', { name: /problemas/i })).toHaveCount(0)
  })

  test('a silent player offers the recorded way out', async ({ page, context }) => {
    await open(page, context, 'silent', flow())
    await dialog(page)
      .getByRole('button', { name: /Reproducir/ })
      .click()
    const out = dialog(page).getByRole('button', { name: /problemas/i })
    await expect(out).toBeVisible({ timeout: 15_000 })
    await out.click()
    await expect(next(page)).toHaveAttribute('aria-disabled', 'false')
  })

  test('a player error offers the way out at once', async ({ page, context }) => {
    await open(page, context, 'errors', flow())
    await dialog(page)
      .getByRole('button', { name: /Reproducir/ })
      .click()
    await expect(dialog(page).getByRole('button', { name: /problemas/i })).toBeVisible()
  })
})
