import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { app } from './support.ts'
import { TrainerMock, type MockOptions } from './trainerMock.ts'

// The exam step outside a student's real run. In a preview there is no "Empezar" and no request;
// in "Simular recorrido" the result screens are simulated, with no attempt, save or submit.
// Against the spec-derived exam mock (TrainerMock records every call it answers).

const welcome = {
  enabled: true,
  title: null,
  message: null,
  video: null,
  playOnEnter: true,
  show: 'first_visit',
  steps: [
    {
      type: 'assessment',
      key: 'check001',
      title: 'Evaluación de entrada',
      mandatory: true,
      revision: 1,
      purpose: 'check_in',
    },
  ],
}

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

const open = async (
  page: Page,
  context: BrowserContext,
  role: 'student' | 'editor',
  mock: MockOptions = {}
) => {
  const server = new TrainerMock({ preview: true, ...mock })
  await server.install(context)
  await page.goto('/mock-host/index.html')
  await page
    .locator('label:has(select)')
    .filter({ hasText: /^role/ })
    .locator('select')
    .selectOption(role)
  const input = page.locator('label:has-text("app URL") input')
  const current = await input.inputValue()
  await input.fill(
    `${current.split('?')[0]}?mockStableIds=1&mockWelcomeJson=${encodeURIComponent(JSON.stringify(welcome))}&mockClosingJson=${encodeURIComponent(JSON.stringify(closing))}`
  )
  await page.getByRole('button', { name: '(Re)load app' }).click()
  const level = app(page).getByRole('button', { name: /^1/ }).first()
  await level.waitFor({ timeout: 8000 })
  await level.click()
  if (role === 'editor')
    await app(page).getByRole('radio', { name: 'Vista previa', exact: true }).click()
  await dialog(page).waitFor()
  return server
}

const dialog = (page: Page) => app(page).getByRole('dialog', { name: 'Bienvenida', exact: true })
const sim = (page: Page) => app(page).getByTestId('journey-simulator')
const simulate = async (page: Page, choice: string) => {
  await sim(page).getByRole('button', { name: 'Empezar simulación' }).click()
  await dialog(page).getByRole('button', { name: choice }).click()
}

const writes = (server: TrainerMock) => server.calls.filter((call) => call.method !== 'GET')

test.describe('the exam step in an editor’s preview', () => {
  test('has no way to start a real attempt and asks for nothing', async ({ page, context }) => {
    const server = await open(page, context, 'editor')
    await expect(dialog(page).getByText(/En la vista previa no se crea un intento/)).toBeVisible()
    await expect(
      dialog(page).getByRole('button', { name: /Empezar|Continuar la evaluación/ })
    ).toHaveCount(0)
    expect(server.calls).toEqual([])
  })

  test('simulated pass: the congratulations, with nothing to report or retry', async ({
    page,
    context,
  }) => {
    const server = await open(page, context, 'editor')
    await simulate(page, 'Simular aprobar')
    await expect(dialog(page).getByTestId('simulation-banner')).toBeVisible()
    await expect(
      dialog(page).getByText(
        '¡Felicidades! Completaste la evaluación diagnóstica con 90.00 %, más del 80 % que se pide.'
      )
    ).toBeVisible()
    await expect(
      dialog(page).getByRole('status').filter({ hasText: '¡Felicidades!' })
    ).toHaveAttribute('aria-live', 'polite')
    await expect(dialog(page).getByRole('heading', { name: 'Tu punto de partida' })).toBeFocused()
    await expect(dialog(page).getByRole('button', { name: 'Reportar un error' })).toHaveCount(0)
    await expect(dialog(page).getByText('Tu curso quedó completado.')).toHaveCount(0)
    expect(server.calls).toEqual([])
  })

  test('simulated not pass: the screen a student would see', async ({ page, context }) => {
    const server = await open(page, context, 'editor')
    await simulate(page, 'Simular no aprobar')
    await expect(dialog(page).getByText('60.00 %', { exact: true }).first()).toBeVisible()
    await expect(
      dialog(page).getByText(/Este es tu punto de partida\. A partir de aquí vas a avanzar\./)
    ).toBeVisible()
    await expect(
      dialog(page).getByText(/llega al cierre cuando completa el contenido/)
    ).toBeVisible()
    expect(writes(server)).toEqual([])
  })

  test('exactly 80 % does not pass: the rule is strictly above', async ({ page, context }) => {
    await open(page, context, 'editor')
    await simulate(page, 'Simular justo 80 %')
    await expect(dialog(page).getByText('80.00 %', { exact: true }).first()).toBeVisible()
    await expect(
      dialog(page).getByText('Con exactamente 80 % no se aprueba: hay que superar el 80 %.')
    ).toBeVisible()
    await expect(dialog(page).getByText(/¡Felicidades!/)).toHaveCount(0)
  })
})

test.describe('students never see the simulation', () => {
  test('a student gets the real exam step, even when the backend says preview', async ({
    page,
    context,
  }) => {
    // The role gate on its own: the list says preview, the host says student.
    const server = await open(page, context, 'student')
    await expect(
      dialog(page)
        .getByRole('button', { name: /^(Empezar la evaluación|Abrir)/ })
        .first()
    ).toBeVisible()
    await expect(sim(page)).toHaveCount(0)
    await expect(app(page).getByTestId('simulated-exam')).toHaveCount(0)
    await expect(app(page).getByRole('button', { name: /Simular/ })).toHaveCount(0)
    expect(writes(server)).toEqual([])
  })

  test('nor on the idle exam screen', async ({ page, context }) => {
    await open(page, context, 'student', { preview: false })
    await dialog(page)
      .getByRole('button')
      .filter({ hasText: /Empezar|Abrir|Continuar la/ })
      .first()
      .click()
    await expect(app(page).getByRole('button', { name: /Simular/ })).toHaveCount(0)
  })
})
