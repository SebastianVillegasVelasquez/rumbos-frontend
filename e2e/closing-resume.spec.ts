import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { closingCard, closingStatus, enterFromCard, serveClosingStatus } from './closingStatus.ts'
import { app } from './support.ts'
import { TrainerMock } from './trainerMock.ts'

// Where a student is on every load, one test per row of the states table
// (docs/WELCOME-FLOW.md). The backend is the spec-checked closing status; Moodle is the mock
// host, which keeps the flow progress while the app reloads, as Moodle does.

const htmlStep = (key: string, title: string) => ({
  type: 'html',
  key,
  title,
  mandatory: true,
  revision: 1,
  html: `<p>${title}</p>`,
  css: null,
  ack: null,
  minSeconds: 0,
})

const closing = {
  enabled: true,
  title: null,
  message: null,
  video: null,
  playOnEnter: null,
  show: 'always',
  steps: [
    htmlStep('closehtml1', 'Lo que lograste'),
    htmlStep('closehtml2', 'Lo que sigue'),
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

const dialog = (page: Page) => app(page).getByRole('dialog', { name: 'Cierre', exact: true })
const next = (page: Page) => dialog(page).getByRole('button', { name: /^(Continuar|Terminar)$/ })
const step = (page: Page, text: string) =>
  dialog(page)
    .getByText(new RegExp(`^${text}`))
    .first()
const congratulations = (page: Page) => app(page).getByTestId('congratulations')
const exhausted = (page: Page) => app(page).getByTestId('exhausted')
const hudButton = (page: Page) => app(page).getByRole('button', { name: 'Cierre', exact: true })

// The level card, or the level itself when the browser remembers where the student was.
const openLevelCard = async (page: Page) => {
  const level = app(page).getByRole('button', { name: /^1/ }).first()
  const onLevel = app(page).locator('[data-hud-dim]')
  await expect(level.or(onLevel).first()).toBeVisible({ timeout: 15_000 })
  if (!(await onLevel.isVisible())) await level.click()
}

// A new visit to the host page. The browser keeps its storage; the mock Moodle starts empty.
const visit = async (page: Page, extra = '') => {
  await page.goto('/mock-host/index.html')
  const input = page.locator('label:has-text("app URL") input')
  const base = (await input.inputValue()).split('?')[0]
  await input.fill(
    `${base}?mockStableIds=1&mockWelcome=disabled&mockClosingJson=${encodeURIComponent(JSON.stringify(closing))}${extra}`
  )
  await page.getByRole('button', { name: '(Re)load app' }).click()
  await openLevelCard(page)
}

const start = async (page: Page, context: BrowserContext, status: object, extra = '') => {
  const current = { value: status }
  await serveClosingStatus(context, current)
  await visit(page, extra)
  return current
}

// The app loads again; Moodle keeps what it recorded.
const reload = async (page: Page) => {
  const before = await page.locator('#frame-wrap iframe').elementHandle()
  // A flow in the mock host's full stage covers the host's own controls.
  await page.getByRole('button', { name: '(Re)load app' }).dispatchEvent('click')
  await expect.poll(() => before!.evaluate((node) => node.isConnected)).toBe(false)
  await openLevelCard(page)
}

// The first visit to a level opens a note and a three-step guide.
const closeIntro = async (page: Page) => {
  const note = app(page).getByRole('dialog', { name: 'Bienvenida al curso' })
  await note.waitFor({ timeout: 8000 })
  await note.getByRole('button', { name: 'Cerrar' }).first().click()
  await app(page).getByRole('button', { name: 'Omitir' }).click()
  await expect(app(page).getByRole('dialog')).toHaveCount(0)
}

// The map in normal mode: no card, no screen, no flow and no button, after the answers are in.
const expectPlainMap = async (page: Page) => {
  await expect(app(page).getByRole('button', { name: 'Misiones' })).toBeVisible()
  // Nothing to wait for: give the status and Moodle's progress time to arrive.
  await page.waitForTimeout(2500)
  await expect(closingCard(page)).toHaveCount(0)
  await expect(congratulations(page)).toHaveCount(0)
  await expect(exhausted(page)).toHaveCount(0)
  await expect(dialog(page)).toHaveCount(0)
  await expect(hudButton(page)).toHaveCount(0)
}

const expectCardOnly = async (page: Page) => {
  await expect(closingCard(page)).toBeVisible({ timeout: 20_000 })
  await expect(dialog(page)).toHaveCount(0)
  await expect(congratulations(page)).toHaveCount(0)
  await expect(hudButton(page)).toHaveCount(0)
}

test.describe('content done, closing not started', () => {
  test('offers the card and never opens over the map', async ({ page, context }) => {
    await start(page, context, closingStatus('required'))
    await closeIntro(page)
    await expectCardOnly(page)
  })

  test('the browser closed after the last activity: the card on the next visit', async ({
    page,
    context,
  }) => {
    const current = await start(page, context, closingStatus('locked', { completed: 4 }))
    await closeIntro(page)
    await expectPlainMap(page)
    // The last activity is done and the tab is gone before the app hears of it.
    await page.goto('about:blank')
    current.value = closingStatus('required')
    await visit(page)
    await expectCardOnly(page)
  })
})

test.describe('closing in progress', () => {
  test('a reload resumes on the step Moodle has pending, without a press', async ({
    page,
    context,
  }) => {
    await start(page, context, closingStatus('required'))
    await closeIntro(page)
    await enterFromCard(page)
    await expect(step(page, 'Paso 1 de 3')).toBeVisible()
    await next(page).click()
    await expect(step(page, 'Paso 2 de 3')).toBeVisible()

    await reload(page)
    await expect(dialog(page)).toBeVisible({ timeout: 20_000 })
    await expect(step(page, 'Paso 2 de 3')).toBeVisible()
    await expect(app(page).getByRole('dialog')).toHaveCount(1)
    await expect(closingCard(page)).toHaveCount(0)
  })

  test('on a first visit to this browser, nothing opens on top of the resumed flow', async ({
    page,
    context,
  }) => {
    await start(page, context, closingStatus('required'))
    await closeIntro(page)
    await enterFromCard(page)
    await next(page).click()
    await expect(step(page, 'Paso 2 de 3')).toBeVisible()
    // Another device: nothing in the browser, the same Moodle.
    await page
      .frameLocator('#frame-wrap iframe')
      .locator('body')
      .evaluate(() => localStorage.clear())

    await reload(page)
    await expect(step(page, 'Paso 2 de 3')).toBeVisible({ timeout: 20_000 })
    await expect(app(page).getByRole('dialog')).toHaveCount(1)
  })
})

test.describe('check-in passed', () => {
  const passed = () => closingStatus('not_required_passed_checkin')

  test('the congratulations come back until they are read', async ({ page, context }) => {
    await start(page, context, passed())
    await expect(congratulations(page)).toBeVisible({ timeout: 20_000 })
    await expect(app(page).getByRole('dialog')).toHaveCount(1)
    await reload(page)
    await expect(congratulations(page)).toBeVisible({ timeout: 20_000 })
  })

  test('read, then reloaded before the first step: the card, no dead end', async ({
    page,
    context,
  }) => {
    await start(page, context, passed())
    await congratulations(page).getByRole('button', { name: 'Continuar' }).click()
    await expect(step(page, 'Paso 1 de 2')).toBeVisible({ timeout: 20_000 })

    await reload(page)
    await expect(closingCard(page)).toBeVisible({ timeout: 20_000 })
    await expect(congratulations(page)).toHaveCount(0)
    await expect(dialog(page)).toHaveCount(0)
    await expect(hudButton(page)).toHaveCount(0)
  })

  test('resumes mid-closing, and once finished shows no prompt again', async ({
    page,
    context,
  }) => {
    await start(page, context, passed())
    await congratulations(page).getByRole('button', { name: 'Continuar' }).click()
    await next(page).click()
    await expect(step(page, 'Paso 2 de 2')).toBeVisible()

    await reload(page)
    await expect(step(page, 'Paso 2 de 2')).toBeVisible({ timeout: 20_000 })
    await expect(congratulations(page)).toHaveCount(0)
    await next(page).click()
    await expect(dialog(page)).toHaveCount(0)
    await expect(closingCard(page)).toHaveCount(0)

    // The first-visit note waited behind the flow; left open it would be back after the reload.
    await closeIntro(page)
    await reload(page)
    await expectPlainMap(page)
  })
})

test.describe('the final exam', () => {
  test('passed: its congratulations once, then the map with no closing prompt', async ({
    page,
    context,
  }) => {
    await start(page, context, closingStatus('passed'))
    await expect(
      congratulations(page).getByRole('heading', { name: '¡Terminaste el curso!' })
    ).toBeVisible({ timeout: 20_000 })
    await congratulations(page).getByRole('button', { name: 'Continuar' }).click()
    await expect(dialog(page)).toHaveCount(0)
    // The first-visit note waited behind the congratulations. It counts as read only once
    // closed, so one left open would be back after the reload, over the map.
    await closeIntro(page)
    await reload(page)
    await expectPlainMap(page)
  })

  test('"Terminar" without a pass: the card stays, and the flow opens on the exam', async ({
    page,
    context,
  }) => {
    // The exam list lets "Terminar" through while the journey still asks for the final.
    await new TrainerMock({ state: 'passed' }).install(context)
    await start(page, context, closingStatus('required'))
    await closeIntro(page)
    await enterFromCard(page)
    await next(page).click()
    await expect(step(page, 'Paso 2 de 3')).toBeVisible()
    await next(page).click()
    await expect(step(page, 'Paso 3 de 3')).toBeVisible()
    await dialog(page).getByRole('button', { name: 'Terminar' }).click()
    await expect(dialog(page)).toHaveCount(0)
    await expectCardOnly(page)

    await reload(page)
    await expectCardOnly(page)
    await enterFromCard(page)
    await expect(step(page, 'Paso 3 de 3')).toBeVisible()
  })

  test('attempts spent: the review screen on every load, also mid-closing', async ({
    page,
    context,
  }) => {
    const current = await start(page, context, closingStatus('required'))
    await closeIntro(page)
    await enterFromCard(page)
    await next(page).click()
    await expect(step(page, 'Paso 2 de 3')).toBeVisible()

    current.value = closingStatus('exhausted')
    await reload(page)
    await expect(exhausted(page)).toBeVisible({ timeout: 20_000 })
    await expect(dialog(page)).toHaveCount(0)
    await expect(app(page).getByText(/no_attempts_left/)).toHaveCount(0)
    await exhausted(page).getByRole('button', { name: 'Volver al mapa' }).click()
    await expect(exhausted(page)).toHaveCount(0)
    await expect(closingCard(page)).toHaveCount(0)
    await reload(page)
    await expect(exhausted(page)).toBeVisible({ timeout: 20_000 })
  })
})

test.describe('closing unavailable', () => {
  for (const reason of ['scorm_incomplete', 'progress_unavailable', 'user_unlinked']) {
    test(`${reason}: no prompt and no code`, async ({ page, context }) => {
      await start(page, context, closingStatus('locked', { reason }))
      await closeIntro(page)
      await expectPlainMap(page)
      await expect(app(page).getByText(new RegExp(reason))).toHaveCount(0)
    })
  }

  test('a status that cannot be read: the map, no prompt', async ({ page, context }) => {
    await context.route(/\/trainer\/closing(\?.*)?$/, (route) =>
      route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })
    )
    await visit(page)
    await closeIntro(page)
    await expectPlainMap(page)
  })
})

test.describe('a deep link to the closing', () => {
  const link = '&view=closing&flow=closing&closing=1&step=closefinal1'

  test('with the content done: the card, as any load', async ({ page, context }) => {
    await start(page, context, closingStatus('required'), link)
    await closeIntro(page)
    await expectCardOnly(page)
  })

  test('while unavailable: the map, never a blank screen', async ({ page, context }) => {
    await start(page, context, closingStatus('locked'), link)
    await closeIntro(page)
    await expectPlainMap(page)
  })

  test('after a passed check-in: the congratulations', async ({ page, context }) => {
    await start(page, context, closingStatus('not_required_passed_checkin'), link)
    await expect(congratulations(page)).toBeVisible({ timeout: 20_000 })
  })
})

test.describe('the editor', () => {
  test('keeps the "Cierre" button in the preview, and it records nothing', async ({ page }) => {
    await page.goto('/mock-host/index.html')
    await page.locator('label:has-text("role") select').selectOption('editor')
    await page.locator('label:has-text("editing on") input').check()
    const input = page.locator('label:has-text("app URL") input')
    const base = (await input.inputValue()).split('?')[0]
    await input.fill(
      `${base}?mockStableIds=1&mockWelcome=disabled&mockClosingJson=${encodeURIComponent(JSON.stringify(closing))}`
    )
    await page.getByRole('button', { name: '(Re)load app' }).click()
    await openLevelCard(page)
    await app(page).getByRole('radio', { name: 'Vista previa', exact: true }).click()
    await hudButton(page).click()
    await expect(dialog(page).getByText('Vista previa: no se guarda nada.')).toBeVisible()
    await next(page).click()
    await expect(step(page, 'Paso 2 de 3')).toBeVisible()
    await expect(page.locator('#log')).not.toContainText('flow-step-done')
  })
})
