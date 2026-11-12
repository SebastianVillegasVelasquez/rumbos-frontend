import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { app, routeProvider } from './support.ts'
import { stubMedia } from './audioStub.ts'

// The welcome flow against the mock host (which plays the plugin side of host
// contract v5.8) and the mock backend. Only the media element and the provider
// pages are stubbed; the player, the reducer, the persistence and the host
// messages are real.

const steps = {
  enabled: true,
  title: null,
  message: null,
  video: null,
  playOnEnter: true,
  show: 'first_visit',
  steps: [
    {
      type: 'welcome',
      key: 'welcome001',
      title: 'Bienvenida al curso',
      mandatory: true,
      revision: 1,
      message: 'Antes de empezar, tres pasos.',
      buttonLabel: null,
    },
    {
      type: 'html',
      key: 'html00001',
      title: 'Reglas',
      mandatory: true,
      revision: 1,
      html: '<h2>Reglas</h2><p>Sé amable.</p>',
      css: 'h2{color:#123}',
      ack: { label: 'Leí y acepto las reglas' },
      minSeconds: 2,
    },
    {
      type: 'quiz',
      key: 'quiz00001',
      title: 'Evaluación de entrada',
      mandatory: true,
      revision: 1,
      cmid: 101,
      intro: 'Responde la evaluación.',
      outcomeAbove: 'Muy bien.',
      outcomeBelow: null,
    },
  ],
}

const open = async (page: Page, context: BrowserContext, welcome: object) => {
  await stubMedia(context)
  await routeProvider(context, 'small')
  await page.goto('/mock-host/index.html')
  const input = page.locator('label:has-text("app URL") input')
  const current = await input.inputValue()
  await input.fill(
    `${current.split('?')[0]}?mockStableIds=1&mockWelcomeJson=${encodeURIComponent(JSON.stringify(welcome))}`
  )
  await page.getByRole('button', { name: '(Re)load app' }).click()
  const level = app(page).getByRole('button', { name: /^1/ }).first()
  // With stable ids the app reopens the last map by itself: click the level only
  // when the list is what is showing.
  await level
    .waitFor({ timeout: 5000 })
    .then(() => level.click())
    .catch(() => undefined)
}

const dialog = (page: Page) => app(page).getByRole('dialog', { name: 'Bienvenida', exact: true })
const next = (page: Page) =>
  dialog(page).getByRole('button', { name: /^(Continuar|Terminar|Empezar viaje)$/ })
const hostLog = (page: Page) => page.locator('#log')

test.describe('welcome flow', () => {
  test('goes through every step, gates each one, and records progress in the host', async ({
    page,
    context,
  }) => {
    await open(page, context, steps)
    await expect(dialog(page)).toBeVisible()
    await expect(dialog(page).getByText('Paso 1 de 3', { exact: true })).toBeVisible()
    await expect(dialog(page).getByRole('heading', { name: 'Bienvenida al curso' })).toBeFocused()

    await dialog(page).getByRole('button', { name: 'Empezar viaje' }).click()

    // The html step: time and acknowledgement, explained in visible text.
    await expect(dialog(page).getByRole('heading', { name: 'Reglas' })).toBeVisible()
    await expect(next(page)).toHaveAttribute('aria-disabled', 'true')
    await expect(dialog(page).getByText(/Podrás continuar en/)).toBeVisible()
    await dialog(page).getByRole('checkbox', { name: 'Leí y acepto las reglas' }).check()
    await expect(dialog(page).getByText('Podrás continuar en', { exact: false })).toBeVisible()
    await expect(next(page)).toHaveAttribute('aria-disabled', 'false', { timeout: 6000 })
    // The content lives in a sandboxed frame without scripts.
    const frame = dialog(page).locator('iframe[title^="Contenido"]')
    await expect(frame).toHaveAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox')
    await next(page).click()

    // The quiz step waits for a finished attempt.
    await expect(dialog(page).getByRole('heading', { name: 'Evaluación de entrada' })).toBeVisible()
    await expect(next(page)).toHaveAttribute('aria-disabled', 'true')
    await dialog(page).getByRole('button', { name: 'Realizar la evaluación' }).click()
    await page.getByRole('button', { name: /Quiz attempt finished/ }).click()
    await expect(dialog(page).getByText('Tu resultado: 85 %.')).toBeVisible()
    await expect(dialog(page).getByText('Muy bien.')).toBeVisible()
    await expect(next(page)).toHaveText(/Terminar/)
    await next(page).click()
    await expect(dialog(page)).toHaveCount(0)

    // Moodle (the mock host) was told, and the app sent nothing anywhere else.
    for (const key of ['welcome001', 'html00001', 'quiz00001'])
      await expect(hostLog(page)).toContainText(`"stepKey":"${key}"`)
  })

  test('a viewer who finished does not see it again', async ({ page, context }) => {
    await open(page, context, steps)
    await dialog(page).getByRole('button', { name: 'Empezar viaje' }).click()
    await dialog(page).getByRole('checkbox', { name: 'Leí y acepto las reglas' }).check()
    await expect(next(page)).toHaveAttribute('aria-disabled', 'false', { timeout: 6000 })
    await next(page).click()
    await dialog(page).getByRole('button', { name: 'Realizar la evaluación' }).click()
    await page.getByRole('button', { name: /Quiz attempt finished/ }).click()
    await next(page).click()
    await expect(dialog(page)).toHaveCount(0)

    // Same host (it keeps the progress), the app reloads: nothing to show.
    await page.getByRole('button', { name: '(Re)load app' }).click()
    const level = app(page).getByRole('button', { name: /^1/ }).first()
    // With stable ids the app reopens the last map by itself: click the level only
    // when the list is what is showing.
    await level
      .waitFor({ timeout: 5000 })
      .then(() => level.click())
      .catch(() => undefined)
    // The host answers within a moment; give the gate time to decide.
    await page.waitForTimeout(1500)
    await expect(dialog(page)).toHaveCount(0)
  })

  test('a quiz hidden for this user does not block and is recorded as unavailable', async ({
    page,
    context,
  }) => {
    // 107 is hidden from students in the mock host course state.
    const hidden = { ...steps, steps: [steps.steps[0], { ...steps.steps[2], cmid: 107 }] }
    await open(page, context, hidden)
    await dialog(page).getByRole('button', { name: 'Empezar viaje' }).click()
    await expect(dialog(page).getByText(/No encontramos la evaluación/)).toBeVisible()
    await expect(next(page)).toHaveAttribute('aria-disabled', 'false')
    await next(page).click()
    await expect(dialog(page)).toHaveCount(0)
    await expect(hostLog(page)).toContainText('"stepKey":"quiz00001"')
    await expect(hostLog(page)).toContainText('"method":"unavailable"')
  })

  test('review mode: every step open, nothing written', async ({ page, context }) => {
    await open(page, context, { ...steps, show: 'always' })
    await dialog(page).getByRole('button', { name: 'Empezar viaje' }).click()
    await dialog(page).getByRole('checkbox', { name: 'Leí y acepto las reglas' }).check()
    await expect(next(page)).toHaveAttribute('aria-disabled', 'false', { timeout: 6000 })
    await next(page).click()
    await dialog(page).getByRole('button', { name: 'Realizar la evaluación' }).click()
    await page.getByRole('button', { name: /Quiz attempt finished/ }).click()
    await next(page).click()
    await expect(dialog(page)).toHaveCount(0)
    const written = (await hostLog(page).innerText()).split('flow-step-done').length

    // Reload the app: "always" opens it again, now in review mode.
    await page.getByRole('button', { name: '(Re)load app' }).click()
    const level = app(page).getByRole('button', { name: /^1/ }).first()
    // With stable ids the app reopens the last map by itself: click the level only
    // when the list is what is showing.
    await level
      .waitFor({ timeout: 5000 })
      .then(() => level.click())
      .catch(() => undefined)
    await expect(dialog(page)).toBeVisible()
    await expect(dialog(page).getByText(/Estás repasando la bienvenida/)).toBeVisible()
    await expect(next(page)).toHaveAttribute('aria-disabled', 'false')
    await next(page).click()
    // The html step is open at once, with no wait and no acknowledgement.
    await expect(next(page)).toHaveAttribute('aria-disabled', 'false')
    await next(page).click()
    await next(page).click()
    await expect(dialog(page)).toHaveCount(0)
    expect((await hostLog(page).innerText()).split('flow-step-done').length).toBe(written)
  })
})
