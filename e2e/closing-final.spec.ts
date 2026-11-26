import {
  expect,
  test,
  type BrowserContext,
  type FrameLocator,
  type Locator,
  type Page,
} from '@playwright/test'
import { app } from './support.ts'
import { closingStatus, enterFromCard, serveClosingStatus } from './closingStatus.ts'
import { TrainerMock, type MockOptions } from './trainerMock.ts'

// The closing flow with the final exam as a step, against the spec-derived exam mock
// (TrainerMock) and closing status: the full run, already passed, exhausted attempts, the
// guard error, an editor preview, keyboard reordering and a stale link. A student enters from
// the card on the map; where they are on each load is closing-resume.spec.ts.

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

interface Open {
  mock?: MockOptions
  query?: string
  role?: 'editor'
  // The host's editing mode on (the editor can then switch to the preview view).
  editing?: boolean
}

const open = async (
  page: Page,
  context: BrowserContext,
  { mock = {}, query = '', role, editing = false }: Open
) => {
  const server = new TrainerMock(mock)
  await server.install(context)
  await serveClosingStatus(context, { value: closingStatus('required') })
  await page.goto('/mock-host/index.html')
  if (role === 'editor') {
    await page
      .locator('label:has(select)')
      .filter({ hasText: /^role/ })
      .locator('select')
      .selectOption('editor')
    await page
      .locator('label:has(input[type="checkbox"])')
      .filter({ hasText: /^editing on/ })
      .locator('input')
      [editing ? 'check' : 'uncheck']()
  }
  const input = page.locator('label:has-text("app URL") input')
  const current = await input.inputValue()
  const withClosing = `&mockClosingJson=${encodeURIComponent(JSON.stringify(closing))}`
  await input.fill(
    `${current.split('?')[0]}?mockStableIds=1&mockWelcome=disabled${withClosing}${query}`
  )
  await page.getByRole('button', { name: '(Re)load app' }).click()
  const level = app(page).getByRole('button', { name: /^1/ }).first()
  await level.waitFor({ timeout: 8000 })
  await level.click()
  // The student view opens an info bubble and a guide on the first visit: close both.
  if (!editing) {
    const bubble = app(page).getByRole('dialog', { name: 'Bienvenida al curso' })
    await bubble.waitFor({ timeout: 8000 })
    await bubble.getByRole('button', { name: 'Cerrar' }).first().click()
    await app(page).getByRole('button', { name: 'Omitir' }).click()
  }
  await expect(app(page).getByRole('dialog')).toHaveCount(0)
  return server
}

const button = (page: Page) => app(page).getByRole('button', { name: 'Cierre', exact: true })
const dialog = (page: Page) => app(page).getByRole('dialog', { name: 'Cierre', exact: true })

const toFinalStep = async (page: Page, enter = enterFromCard) => {
  await enter(page)
  await expect(dialog(page)).toBeVisible()
  await dialog(page).getByRole('button', { name: 'Continuar' }).click()
}

const answerVisible = async (frame: FrameLocator | Locator) => {
  const groups = frame.getByRole('radiogroup')
  for (let i = 0; i < (await groups.count()); i++)
    await groups.nth(i).getByRole('radio').first().click({ force: true })
  const clips = frame.locator('ul[aria-label="Audios"] button.exam-pick')
  for (let i = 0; i < (await clips.count()); i++) {
    await clips.nth(i).click()
    await frame.locator('ul[aria-label="Lugares"] button.exam-pick').nth(i).click()
  }
  for (const label of ['Name', 'Country'])
    if (await frame.getByLabel(label, { exact: true }).count())
      await frame.getByLabel(label, { exact: true }).fill('Ana')
  if (await frame.getByLabel('Espacio 1').count()) {
    await frame.getByLabel('Espacio 1').fill('Maria Lopez')
    await frame.getByLabel('Espacio 2').fill('twenty')
  }
  const written = frame.locator('textarea')
  for (let i = 0; i < (await written.count()); i++) await written.nth(i).fill('Ana Lopez')
}

test.describe('closing: entry', () => {
  test('a stale link to the old final exam lands on the map, not a blank screen', async ({
    page,
    context,
  }) => {
    await open(page, context, { query: '&exam=final&view=exam&trainer=final' })
    await expect(app(page).getByRole('button', { name: 'Misiones' })).toBeVisible()
    await expect(app(page).getByText('Evaluación final')).toHaveCount(0)
  })
})

test.describe('closing: the final step', () => {
  test('a full run: Terminar opens when the attempt is submitted', async ({ page, context }) => {
    // Twelve items across five sections: slow in WebKit.
    test.slow()
    await open(page, context, {})
    await toFinalStep(page)
    const terminar = dialog(page).getByRole('button', { name: 'Terminar' })
    await expect(terminar).toHaveAttribute('aria-disabled', 'true')
    await dialog(page).getByRole('button', { name: 'Empezar la evaluación' }).click()
    await dialog(page).getByRole('button', { name: 'Empezar', exact: true }).click()
    for (let section = 1; section <= 5; section++) {
      await expect(
        dialog(page)
          .getByText(new RegExp(`Sección ${section} de 5`))
          .first()
      ).toBeVisible()
      await expect(dialog(page).getByRole('timer')).toBeVisible()
      await answerVisible(dialog(page))
      if (section < 5) await dialog(page).getByRole('button', { name: 'Siguiente sección' }).click()
    }
    await dialog(page).getByRole('button', { name: 'Revisar y entregar' }).first().click()
    await dialog(page).getByRole('button', { name: 'Entregar', exact: true }).click()
    await dialog(page).getByRole('button', { name: 'Sí, entregar' }).click()
    await expect(dialog(page).getByRole('heading', { name: 'Tu resultado' })).toBeVisible({
      timeout: 20_000,
    })
    // Not a preview: no "not a student's result" note.
    await expect(dialog(page).getByText(/no es el resultado de un estudiante/)).toHaveCount(0)
    // Submitted: the exit continues, and on the last step that finishes the flow.
    await dialog(page)
      .getByRole('button', { name: /^(Continuar|Terminar)$/ })
      .first()
      .click()
    await expect(dialog(page)).toHaveCount(0)
  })

  test('already passed: "Ya aprobaste", and Terminar is open', async ({ page, context }) => {
    await open(page, context, { mock: { state: 'passed' } })
    await toFinalStep(page)
    await expect(dialog(page).getByText('Ya aprobaste.')).toBeVisible()
    await expect(dialog(page).getByText('No necesitas hacer esta evaluación.')).toBeVisible()
    await expect(dialog(page).getByRole('button', { name: 'Terminar' })).not.toHaveAttribute(
      'aria-disabled',
      'true'
    )
  })

  test('attempts exhausted: says so and does not trap the student', async ({ page, context }) => {
    await open(page, context, { mock: { state: 'exhausted' } })
    await toFinalStep(page)
    await expect(
      dialog(page).getByText('Ya usaste todos los intentos de la evaluación final.')
    ).toBeVisible()
    await expect(dialog(page).getByRole('button', { name: 'Terminar' })).not.toHaveAttribute(
      'aria-disabled',
      'true'
    )
  })

  test('locked by SCORM in the list: a sentence, never the code, and the recorded escape', async ({
    page,
    context,
  }) => {
    await open(page, context, {
      mock: { state: 'locked', lockedReason: 'scorm_incomplete' },
    })
    await toFinalStep(page)
    await expect(
      dialog(page).getByText('Completa todos los contenidos para abrir la evaluación final.')
    ).toBeVisible()
    await expect(dialog(page).getByText(/scorm_incomplete/)).toHaveCount(0)
    await expect(
      dialog(page).getByRole('button', { name: 'Continuar de todos modos' })
    ).toBeVisible()
  })

  test('loading is announced with aria-busy', async ({ page, context }) => {
    await open(page, context, { mock: { listDelayMs: 2500 } })
    await toFinalStep(page)
    await expect(dialog(page).locator('[aria-busy="true"]')).toBeVisible()
    await expect(dialog(page).getByText('Comprobando…')).toBeVisible()
    await expect(dialog(page).getByRole('button', { name: 'Empezar la evaluación' })).toBeVisible({
      timeout: 15_000,
    })
  })

  test('a server error offers Reintentar and keeps Terminar closed', async ({ page, context }) => {
    await open(page, context, { mock: { listStatus: 503 } })
    await toFinalStep(page)
    await expect(dialog(page).getByText('No pudimos cargar la evaluación.')).toBeVisible({
      timeout: 45_000,
    })
    await expect(dialog(page).getByRole('button', { name: 'Reintentar' })).toBeVisible()
    await expect(dialog(page).getByRole('button', { name: 'Terminar' })).toHaveAttribute(
      'aria-disabled',
      'true'
    )
  })

  test('the guard error says why, offers a way back, and no Reintentar', async ({
    page,
    context,
  }) => {
    await open(page, context, {
      mock: { startError: { status: 409, code: 'closing_not_available' } },
    })
    await toFinalStep(page)
    await dialog(page).getByRole('button', { name: 'Empezar la evaluación' }).click()
    await dialog(page).getByRole('button', { name: 'Empezar', exact: true }).click()
    await expect(
      dialog(page).getByText(/El cierre todavía no está disponible para ti/)
    ).toBeVisible()
    await expect(dialog(page).getByText(/closing_not_available/)).toHaveCount(0)
    await expect(dialog(page).getByRole('button', { name: 'Reintentar' })).toHaveCount(0)
    await dialog(page).getByRole('button', { name: 'Volver', exact: true }).click()
    // Back on the step, which looks the state up again.
    await expect(dialog(page).getByRole('button', { name: 'Empezar la evaluación' })).toBeVisible()
  })
})

test.describe('closing: an editor in preview', () => {
  test('can open the flow while it is locked, and the attempt says it does not count', async ({
    page,
    context,
  }) => {
    await open(page, context, {
      role: 'editor',
      editing: true,
      mock: { preview: true },
    })
    await app(page).getByRole('radio', { name: 'Vista previa', exact: true }).click()
    await toFinalStep(page, (target) => button(target).click())
    await expect(
      dialog(page)
        .getByText(/Vista previa: este intento no se guarda ni cuenta/)
        .first()
    ).toBeVisible()
    await dialog(page).getByRole('button', { name: 'Empezar la evaluación' }).click()
    await expect(
      dialog(page)
        .getByText(/Vista previa: este intento no se guarda ni cuenta/)
        .first()
    ).toBeVisible()
  })
})

test.describe('closing: authoring', () => {
  test('explains the gate and reorders steps with the keyboard', async ({ page }) => {
    await page.goto('/mock-host/index.html')
    await page.locator('label:has-text("role") select').selectOption('editor')
    await page.locator('label:has-text("editing on") input').check()
    const input = page.locator('label:has-text("app URL") input')
    const current = await input.inputValue()
    await input.fill(
      `${current.split('?')[0]}?mockStableIds=1&mockClosingJson=${encodeURIComponent(JSON.stringify(closing))}`
    )
    await page.getByRole('button', { name: '(Re)load app' }).click()
    const level = app(page).getByRole('button', { name: /^1/ }).first()
    await level.waitFor()
    await level.click()
    await app(page)
      .getByRole('button', { name: /^Apariencia/ })
      .first()
      .click()
    await app(page).getByRole('button', { name: 'Cierre', exact: true }).first().click()
    const list = app(page).locator('ol[aria-label="Flujo de cierre"] > li')
    await expect(list).toHaveCount(2)
    await app(page)
      .getByRole('button', { name: /Evaluación final/ })
      .first()
      .click()
    await expect(
      app(page).getByText(
        'Este paso se desbloquea cuando el estudiante completa todos los contenidos SCORM.'
      )
    ).toBeVisible()
    const up = app(page).getByRole('button', { name: /^Subir paso: Evaluación final/ })
    await up.focus()
    await page.keyboard.press('Enter')
    const titles = await list.allInnerTexts()
    expect(titles[0]).toContain('Evaluación final')
  })
})
