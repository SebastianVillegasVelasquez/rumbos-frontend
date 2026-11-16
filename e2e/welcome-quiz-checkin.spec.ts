import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { app, routeProvider } from './support.ts'
import { stubMedia } from './audioStub.ts'

// The check-in step of the welcome flow against the mock host, which plays the
// plugin side of contract v5.8/v5.9. For each answer the plugin can give, the step
// must say something true, keep "Comprobar de nuevo" visibly alive, and never be a
// trap: every way out is recorded through flow-step-done with its method.

const flow = {
  enabled: true,
  title: null,
  message: null,
  video: null,
  playOnEnter: true,
  show: 'first_visit',
  steps: [
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
    {
      type: 'welcome',
      key: 'welcome001',
      title: 'Listo',
      mandatory: true,
      revision: 1,
      message: 'Terminaste.',
      buttonLabel: null,
    },
  ],
}

interface Options {
  scenario: string
  role?: 'student' | 'editor'
}

const open = async (page: Page, context: BrowserContext, { scenario, role }: Options) => {
  await stubMedia(context)
  await routeProvider(context, 'small')
  await page.goto('/mock-host/index.html')
  if (role)
    await page
      .locator('label:has(select)')
      .filter({ hasText: /^role/ })
      .locator('select')
      .selectOption(role)
  // A teacher with Moodle's editing mode off: the role is editor, the UI is the student's.
  if (role === 'editor')
    await page
      .locator('label:has(input[type="checkbox"])')
      .filter({ hasText: /^editing on/ })
      .locator('input')
      .uncheck()
  await page.getByLabel('quiz result', { exact: false }).selectOption(scenario)
  const input = page.locator('label:has-text("app URL") input')
  const current = await input.inputValue()
  await input.fill(
    `${current.split('?')[0]}?mockStableIds=1&mockWelcomeJson=${encodeURIComponent(JSON.stringify(flow))}`
  )
  await page.getByRole('button', { name: '(Re)load app' }).click()
  const level = app(page).getByRole('button', { name: /^1/ }).first()
  await level
    .waitFor({ timeout: 5000 })
    .then(() => level.click())
    .catch(() => undefined)
  await dialog(page).waitFor()
}

const dialog = (page: Page) => app(page).getByRole('dialog', { name: 'Bienvenida', exact: true })
const next = (page: Page) => dialog(page).getByRole('button', { name: /^(Continuar|Terminar)$/ })
const checkButton = (page: Page) =>
  dialog(page).getByRole('button', { name: /^(Comprobar de nuevo|Comprobando…)$/ })
const escapeButton = (page: Page) =>
  dialog(page).getByRole('button', { name: 'Continuar de todos modos' })
const hostLog = (page: Page) => page.locator('#log')
const asks = async (page: Page) =>
  ((await hostLog(page).innerText()).match(/app→host.*request-quiz-result/g) ?? []).length
const recorded = (method: string) => new RegExp(`flow-step-done[^\\n]*quiz00001[^\\n]*"${method}"`)

test.describe('check-in: what the step says for each answer', () => {
  test('no attempts (an older plugin): waits, and says what it knows', async ({
    page,
    context,
  }) => {
    await open(page, context, { scenario: 'no attempts' })
    await expect(next(page)).toHaveAttribute('aria-disabled', 'true')
    await expect(dialog(page).getByText(/Todavía no vemos un intento terminado/)).toBeVisible()
    await expect(dialog(page).getByRole('button', { name: 'Abrir cuestionario' })).toBeVisible()
    await expect(escapeButton(page)).toHaveCount(0)
  })

  test('v5.9 no attempts: tells the student to open the quiz', async ({ page, context }) => {
    await open(page, context, { scenario: 'no attempts (v5.9)' })
    await expect(dialog(page).getByText(/Abre el cuestionario, respóndelo/)).toBeVisible()
    await expect(next(page)).toHaveAttribute('aria-disabled', 'true')
  })

  test('v5.9 in progress: asks to send the open attempt', async ({ page, context }) => {
    await open(page, context, { scenario: 'in progress (v5.9)' })
    await expect(
      dialog(page).getByText(
        'Tienes un intento sin enviar. Ábrelo y pulsa «Enviar todo y terminar».'
      )
    ).toBeVisible()
    await expect(dialog(page).getByRole('button', { name: 'Continuar el intento' })).toBeVisible()
    await expect(next(page)).toHaveAttribute('aria-disabled', 'true')
  })

  test('a finished attempt completes it', async ({ page, context }) => {
    await open(page, context, { scenario: 'passed (v5.9)' })
    await expect(dialog(page).getByText('Tu resultado: 85 %.')).toBeVisible()
    await expect(next(page)).toHaveAttribute('aria-disabled', 'false')
    await next(page).click()
    await expect(hostLog(page)).toContainText(recorded('completed'))
  })

  for (const scenario of ['preview only (v5.9)', 'cannot attempt (v5.9)']) {
    test(`${scenario}: a non-student account may continue, recorded as a fallback`, async ({
      page,
      context,
    }) => {
      await open(page, context, { scenario })
      await expect(
        dialog(page).getByText(
          'Tu cuenta no es de estudiante, así que no se registra un intento. Puedes continuar.'
        )
      ).toBeVisible()
      await expect(next(page)).toHaveAttribute('aria-disabled', 'false')
      await expect(escapeButton(page)).toHaveCount(0)
      await next(page).click()
      await expect(dialog(page).getByRole('heading', { name: 'Listo' })).toBeVisible()
      await expect(hostLog(page)).toContainText(recorded('fallback'))
    })
  }

  test('not graded yet: may continue, completed because an attempt was handed in', async ({
    page,
    context,
  }) => {
    await open(page, context, { scenario: 'not graded yet (v5.9)' })
    await expect(
      dialog(page).getByText('Tu cuestionario está pendiente de calificación. Puedes continuar.')
    ).toBeVisible()
    await expect(next(page)).toHaveAttribute('aria-disabled', 'false')
    await next(page).click()
    await expect(hostLog(page)).toContainText(recorded('completed'))
  })

  for (const scenario of ['not found', 'unavailable', 'no permission']) {
    test(`error reply (${scenario}): does not block, recorded as unavailable`, async ({
      page,
      context,
    }) => {
      await open(page, context, { scenario })
      await expect(dialog(page).getByText(/Puedes continuar\./)).toBeVisible()
      await expect(next(page)).toHaveAttribute('aria-disabled', 'false')
      await next(page).click()
      await expect(hostLog(page)).toContainText(recorded('unavailable'))
    })
  }

  test('no reply at all (an older plugin): stops waiting, recorded as unavailable', async ({
    page,
    context,
  }) => {
    await open(page, context, { scenario: 'older plugin (silent)' })
    await expect(next(page)).toHaveAttribute('aria-disabled', 'true')
    await expect(next(page)).toHaveAttribute('aria-disabled', 'false', { timeout: 9000 })
    await expect(dialog(page).getByText(/No pudimos consultar la evaluación ahora/)).toBeVisible()
    await next(page).click()
    await expect(hostLog(page)).toContainText(recorded('unavailable'))
  })
})

test.describe('check-in: "Comprobar de nuevo" always visibly does something', () => {
  test('sends a request and shows the outcome with its age, even when nothing changed', async ({
    page,
    context,
  }) => {
    await open(page, context, { scenario: 'no attempts' })
    const line = dialog(page).getByText(/^Última comprobación:/)
    await expect(line).toHaveText('Última comprobación: hace unos segundos: 0 intentos finalizados')
    const before = await asks(page)
    await checkButton(page).click()
    await expect.poll(() => asks(page)).toBe(before + 1)
    await expect(line).toHaveText('Última comprobación: hace unos segundos: 0 intentos finalizados')
    await expect(checkButton(page)).toBeEnabled()
  })

  test('is pending while the plugin has not answered, and announces its outcome', async ({
    page,
    context,
  }) => {
    await open(page, context, { scenario: 'answers after 2 s' })
    // The first answer.
    await expect(dialog(page).getByText(/^Última comprobación:/)).toBeVisible({ timeout: 5000 })
    await checkButton(page).click()
    const pending = dialog(page).getByRole('button', { name: 'Comprobando…' })
    await expect(pending).toBeVisible()
    await expect(pending).toBeDisabled()
    await expect(dialog(page).locator('p[aria-live="polite"]').first()).toBeVisible()
    await expect(checkButton(page)).toHaveText('Comprobar de nuevo', { timeout: 5000 })
    await expect(checkButton(page)).toBeEnabled()
  })

  test('a plugin that stops answering: says so after 5 s and gives the button back', async ({
    page,
    context,
  }) => {
    await open(page, context, { scenario: 'answers once, then silent' })
    await expect(dialog(page).getByText(/^Última comprobación:/)).toBeVisible()
    await checkButton(page).click()
    await expect(dialog(page).getByRole('button', { name: 'Comprobando…' })).toBeDisabled()
    await expect(
      dialog(page).getByText('Moodle no respondió a tiempo. Puedes volver a comprobar.')
    ).toBeVisible({
      timeout: 8000,
    })
    await expect(checkButton(page)).toBeEnabled()
    // A missing reply shows the way out at once.
    await expect(escapeButton(page)).toBeVisible()
    await escapeButton(page).click()
    await expect(dialog(page).getByRole('heading', { name: 'Listo' })).toBeVisible()
    await expect(hostLog(page)).toContainText(recorded('fallback'))
  })

  test('the overlay closing re-checks once, and a handed-in attempt unlocks the step', async ({
    page,
    context,
  }) => {
    await open(page, context, { scenario: 'no attempts' })
    await expect(next(page)).toHaveAttribute('aria-disabled', 'true')
    await dialog(page).getByRole('button', { name: 'Abrir cuestionario' }).click()
    // The mock host's button stands for the attempt handed in inside Moodle's overlay;
    // the full stage covers the host page, so the page presses it.
    await page.getByRole('button', { name: /Quiz attempt finished/ }).dispatchEvent('click')
    await expect(dialog(page).getByText('Tu resultado: 85 %.')).toBeVisible()
    await expect(next(page)).toHaveAttribute('aria-disabled', 'false')
  })
})

test.describe('check-in: the recorded escape', () => {
  test('is not there before the quiz was opened, however many times it is checked', async ({
    page,
    context,
  }) => {
    await open(page, context, { scenario: 'no attempts' })
    for (let i = 0; i < 3; i++) {
      await checkButton(page).click()
      await expect(dialog(page).getByText(/^Última comprobación:/)).toBeVisible()
      await page.waitForTimeout(3300)
    }
    await expect(escapeButton(page)).toHaveCount(0)
  })

  test('appears after opening the quiz and two checks that did not confirm, by keyboard', async ({
    page,
    context,
  }) => {
    await open(page, context, { scenario: 'no attempts' })
    await dialog(page).getByRole('button', { name: 'Abrir cuestionario' }).click()
    await checkButton(page).click()
    await expect(dialog(page).getByText(/^Última comprobación:/)).toBeVisible()
    await expect(escapeButton(page)).toHaveCount(0)
    await page.waitForTimeout(3300)
    await checkButton(page).click()
    await expect(escapeButton(page)).toBeVisible()
    await expect(
      dialog(page).getByText('El resultado no se registrará como completado.')
    ).toBeVisible()
    // It sits in a live region (announced) and is next in the tab order.
    await expect(
      dialog(page).locator('[aria-live="polite"] button', { hasText: 'Continuar de todos modos' })
    ).toBeVisible()
    await checkButton(page).focus()
    await page.keyboard.press('Tab')
    await expect(escapeButton(page)).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(dialog(page).getByRole('heading', { name: 'Listo' })).toBeVisible()
    await expect(hostLog(page)).toContainText(recorded('fallback'))
  })
})

test.describe('check-in: the editing role', () => {
  test('is never blocked by the step, and says why', async ({ page, context }) => {
    await open(page, context, { scenario: 'no attempts', role: 'editor' })
    await expect(
      dialog(page).getByText('Tienes permisos de edición, así que este paso no te bloquea.')
    ).toBeVisible()
    await expect(next(page)).toHaveAttribute('aria-disabled', 'false')
    await expect(escapeButton(page)).toHaveCount(0)
  })
})

test.describe('the stage', () => {
  test('a mandatory flow opens in the full stage and gives the room back when it ends', async ({
    page,
    context,
  }) => {
    await open(page, context, { scenario: 'passed (v5.9)' })
    await expect(page.locator('#frame-wrap')).toHaveClass(/fullscreen/)
    await next(page).click()
    await next(page).click()
    await expect(dialog(page)).toHaveCount(0)
    await expect(page.locator('#frame-wrap')).not.toHaveClass(/fullscreen/)
  })
})
