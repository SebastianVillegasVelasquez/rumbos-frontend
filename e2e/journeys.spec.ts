import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { app } from './support.ts'

// The two journeys as a student lives them, driven by GET /trainer/closing (the backend's
// status, built here to the shape contracts/openapi.json declares) and the congratulations
// screen with custom and default text. Chromium and WebKit.

const closing = {
  enabled: true,
  title: null,
  message: null,
  video: null,
  playOnEnter: null,
  show: 'always',
  steps: [
    {
      type: 'html',
      key: 'closehtml1',
      title: 'Lo que lograste',
      mandatory: true,
      revision: 1,
      html: '<h2>Lo que lograste</h2><p>Terminaste el nivel.</p>',
      css: null,
      ack: null,
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

const checkin = (status: string) => ({
  status,
  percent: '85.50',
  pass_percent: 70,
  pass_operator: 'gt',
  attempts: { used: 1, max: 2 },
})

const status = (finalStatus: string, extra: Record<string, unknown> = {}) => ({
  enforced: true,
  preview: false,
  available: false,
  reason: null,
  progress: { completed: 5, total: 5 },
  final: null,
  outcome: {
    checkin: checkin(finalStatus === 'not_required_passed_checkin' ? 'passed' : 'not_passed'),
    final: {
      status: finalStatus,
      reason: null,
      attempts: finalStatus === 'not_required_passed_checkin' ? null : { used: 0, max: 3 },
    },
    scorm_gate: { satisfied: true, reason: null },
  },
  ...extra,
})

// The backend's answer can change during a test: the route reads the current one.
const serveStatus = async (context: BrowserContext, current: { value: object }) => {
  await context.route(/\/trainer\/closing(\?.*)?$/, (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(current.value) })
  )
}

// The student first lands with nothing to celebrate (the first-visit bubble and the guide are
// closed under a neutral status), then the backend's word changes and the host announces it.
const NEUTRAL = status('locked', {
  reason: 'scorm_incomplete',
  progress: { completed: 1, total: 5 },
})
const reveal = async (page: Page, current: { value: object }, next: object) => {
  current.value = next
  await page.getByRole('button', { name: 'Push state now' }).click()
}

const open = async (
  page: Page,
  context: BrowserContext,
  target: { value: object },
  congratulations: object | null = null
) => {
  const current = { value: NEUTRAL as object }
  await serveStatus(context, current)
  await page.goto('/mock-host/index.html')
  const input = page.locator('label:has-text("app URL") input')
  const base = (await input.inputValue()).split('?')[0]
  const extra = congratulations
    ? `&mockCongratulationsJson=${encodeURIComponent(JSON.stringify(congratulations))}`
    : ''
  await input.fill(
    `${base}?mockStableIds=1&mockWelcome=disabled&mockClosingJson=${encodeURIComponent(JSON.stringify(closing))}${extra}`
  )
  await page.getByRole('button', { name: '(Re)load app' }).click()
  const level = app(page).getByRole('button', { name: /^1/ }).first()
  await level.waitFor({ timeout: 8000 })
  await level.click()
  const bubble = app(page).getByRole('dialog', { name: 'Bienvenida al curso' })
  await bubble.waitFor({ timeout: 8000 })
  await bubble.getByRole('button', { name: 'Cerrar' }).first().click()
  await app(page).getByRole('button', { name: 'Omitir' }).click()
  await expect(app(page).getByRole('dialog')).toHaveCount(0)
  await reveal(page, current, target.value)
  return current
}

const screen = (page: Page) => app(page).getByTestId('congratulations')
const closingDialog = (page: Page) => app(page).getByRole('dialog', { name: 'Cierre', exact: true })

test.describe('journey A: the check-in was passed', () => {
  test('shows the default congratulations, then the closing without the final exam', async ({
    page,
    context,
  }) => {
    await open(page, context, { value: status('not_required_passed_checkin') })
    await expect(screen(page)).toBeVisible({ timeout: 20_000 })
    await expect(screen(page).getByRole('heading', { name: '¡Lo lograste!' })).toBeFocused()
    await expect(screen(page).getByTestId('congratulations-body')).toHaveText(
      'Completaste la evaluación diagnóstica con más del 70%.'
    )
    await screen(page).getByRole('button', { name: 'Continuar' }).click()
    await expect(closingDialog(page)).toBeVisible()
    // Only the content step: the final exam is not required.
    await expect(
      closingDialog(page)
        .getByText(/^Paso 1 de 1/)
        .first()
    ).toBeVisible()
    await expect(closingDialog(page).getByText('Evaluación final')).toHaveCount(0)
  })

  test('uses the author text and substitutes the placeholders', async ({ page, context }) => {
    await open(
      page,
      context,
      { value: status('not_required_passed_checkin') },
      {
        checkin: {
          title: 'Sacaste {score}',
          body: 'El mínimo era {threshold}.\nSegunda línea.',
          ctaLabel: 'Seguir',
        },
        final: null,
      }
    )
    await expect(screen(page).getByRole('heading', { name: 'Sacaste 85.5' })).toBeVisible({
      timeout: 20_000,
    })
    await expect(screen(page).getByTestId('congratulations-body')).toContainText(
      'El mínimo era 70.'
    )
    await expect(screen(page).getByRole('button', { name: 'Seguir' })).toBeVisible()
  })

  test('renders an injection attempt as plain text', async ({ page, context }) => {
    const attack = '<img src=x onerror="window.__pwned=1"><b>negrita</b>'
    await open(
      page,
      context,
      { value: status('not_required_passed_checkin') },
      {
        checkin: { title: attack, body: attack, ctaLabel: 'Seguir' },
        final: null,
      }
    )
    await expect(screen(page)).toBeVisible({ timeout: 20_000 })
    await expect(screen(page).getByRole('heading')).toHaveText(attack)
    await expect(screen(page).locator('img, b')).toHaveCount(0)
    const pwned = await page
      .frameLocator('#frame-wrap iframe')
      .locator('body')
      .evaluate(() => (window as unknown as { __pwned?: number }).__pwned ?? 0)
    expect(pwned).toBe(0)
  })

  test('is shown once: it does not come back after the student continues', async ({
    page,
    context,
  }) => {
    await open(page, context, { value: status('not_required_passed_checkin') })
    await screen(page).getByRole('button', { name: 'Continuar' }).click()
    await closingDialog(page)
      .getByRole('button', { name: /^(Continuar|Terminar)$/ })
      .click()
    await expect(closingDialog(page)).toHaveCount(0)
    await expect(screen(page)).toHaveCount(0)
  })
})

test.describe('journey B: the check-in was not passed', () => {
  test('locks the closing while content is missing, then offers the card, then asks the final', async ({
    page,
    context,
  }) => {
    const current = await open(page, context, {
      value: status('locked', {
        available: false,
        reason: 'scorm_incomplete',
        progress: { completed: 2, total: 5 },
      }),
    })
    await expect(app(page).getByRole('button', { name: 'Misiones' })).toBeVisible()
    await expect(app(page).getByRole('button', { name: 'Cierre', exact: true })).toHaveCount(0)
    await expect(app(page).getByTestId('closing-card')).toHaveCount(0)
    await expect(screen(page)).toHaveCount(0)

    // The last required activity is done: the backend says the closing may open.
    // Moodle announces the completion with a fresh state.
    await reveal(page, current, status('required', { available: true, reason: null }))
    const card = app(page).getByTestId('closing-card')
    await expect(card).toBeVisible({ timeout: 25_000 })
    // It never opens by itself over the map.
    await expect(closingDialog(page)).toHaveCount(0)
    await card.getByRole('button', { name: 'Continuar al cierre' }).click()
    await expect(closingDialog(page)).toBeVisible()
    await expect(
      closingDialog(page)
        .getByText(/^Paso 1 de 2/)
        .first()
    ).toBeVisible()
  })

  test('three failed attempts show the review screen and perform nothing', async ({
    page,
    context,
  }) => {
    await open(page, context, {
      value: status('exhausted', {
        reason: 'no_attempts_left',
      }),
    })
    const exhausted = app(page).getByTestId('exhausted')
    await expect(exhausted).toBeVisible({ timeout: 20_000 })
    await expect(
      exhausted.getByRole('heading', { name: 'Toca repasar el contenido' })
    ).toBeFocused()
    await expect(exhausted).toContainText(
      'Agotaste tus intentos. Repasa el contenido del mapa y consulta con tu tutor.'
    )
    await expect(exhausted).not.toContainText(/reinici|desde el principio/i)
    // The browser never writes anything: no request but reads.
    await exhausted.getByRole('button', { name: 'Volver al mapa' }).click()
    await expect(exhausted).toHaveCount(0)
    await expect(screen(page)).toHaveCount(0)
  })

  test('a passed final shows its own congratulations', async ({ page, context }) => {
    await open(page, context, { value: status('passed') })
    await expect(screen(page).getByRole('heading', { name: '¡Terminaste el curso!' })).toBeVisible({
      timeout: 20_000,
    })
  })
})
