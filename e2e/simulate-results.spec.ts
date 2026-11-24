import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { app } from './support.ts'
import { TrainerMock, type MockOptions } from './trainerMock.ts'

// The editor's test tools: simulate the result screens of the check-in and the final exam
// without answering. A UI-only simulation: no attempt, no save, no submit, no host message.
// Against the spec-derived exam mock (TrainerMock records every call it answers) and the draft
// closing shape of the mock API (branch-local until contracts/openapi.json declares it).

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

const closing = (withSteps = true) => ({
  enabled: true,
  title: null,
  message: null,
  video: null,
  playOnEnter: null,
  show: 'always',
  steps: withSteps
    ? [
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
      ]
    : [],
})

interface Open {
  mock?: MockOptions
  role: 'student' | 'editor'
  closingSteps?: boolean
}

// What reaches the host from the app, recorded on the host page.
const watchHostMessages = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __messages: string[] }
    w.__messages = []
    window.addEventListener('message', (event) => w.__messages.push(JSON.stringify(event.data)))
  })
const hostMessages = (page: Page) =>
  page.evaluate(() => (window as unknown as { __messages: string[] }).__messages)

const open = async (
  page: Page,
  context: BrowserContext,
  { mock = {}, role, closingSteps = true }: Open
) => {
  const server = new TrainerMock({ preview: true, ...mock })
  await server.install(context)
  await page.goto('/mock-host/index.html')
  await page
    .locator('label:has(select)')
    .filter({ hasText: /^role/ })
    .locator('select')
    .selectOption(role)
  if (role === 'editor')
    await page
      .locator('label:has(input[type="checkbox"])')
      .filter({ hasText: /^editing on/ })
      .locator('input')
      .uncheck()
  const input = page.locator('label:has-text("app URL") input')
  const current = await input.inputValue()
  await input.fill(
    `${current.split('?')[0]}?mockStableIds=1&mockWelcomeJson=${encodeURIComponent(JSON.stringify(welcome))}&mockClosingJson=${encodeURIComponent(JSON.stringify(closing(closingSteps)))}`
  )
  await page.getByRole('button', { name: '(Re)load app' }).click()
  const level = app(page).getByRole('button', { name: /^1/ }).first()
  await level.waitFor({ timeout: 8000 })
  await level.click()
  await dialog(page).waitFor()
  return server
}

const dialog = (page: Page) => app(page).getByRole('dialog', { name: 'Bienvenida', exact: true })
const closingDialog = (page: Page) => app(page).getByRole('dialog', { name: 'Cierre', exact: true })
const tools = (page: Page) =>
  dialog(page).getByRole('region', { name: 'Herramientas de prueba · solo para editores' })
const banner = (page: Page) =>
  dialog(page).getByText('Simulación: no se guardó nada ni se envió nada a Moodle.')

const writes = (server: TrainerMock) => server.calls.filter((call) => call.method !== 'GET')

test.describe('the editor’s test tools', () => {
  test('simulate pass: congratulations, banner, and the closing flow opens by itself', async ({
    page,
    context,
  }) => {
    const server = await open(page, context, { role: 'editor' })
    await expect(tools(page)).toBeVisible()
    await watchHostMessages(page)
    const before = server.calls.length

    await tools(page).getByRole('button', { name: 'Simular aprobar' }).click()
    await expect(banner(page)).toBeVisible()
    await expect(
      dialog(page).getByText(
        '¡Felicidades! Completaste la evaluación diagnóstica con 90.00 %, más del 80 % que se pide.'
      )
    ).toBeVisible()
    // The result says it is live (a status region).
    await expect(
      dialog(page).getByRole('status').filter({ hasText: '¡Felicidades!' })
    ).toHaveAttribute('aria-live', 'polite')
    // A simulated screen offers no report and no new attempt, and never says it synced.
    await expect(dialog(page).getByRole('button', { name: 'Reportar un error' })).toHaveCount(0)
    await expect(dialog(page).getByText('Tu curso quedó completado.')).toHaveCount(0)

    // Winning the check-in plays what a student's win would: the closing flow opens at once.
    await expect(closingDialog(page)).toBeVisible()
    await expect(
      closingDialog(page).getByRole('heading', { name: 'Lo que lograste' })
    ).toBeVisible()
    await expect(closingDialog(page).getByText('Vista previa: no se guarda nada.')).toBeVisible()
    // Leaving it returns to the result, where "Ver cierre" plays it again.
    await closingDialog(page).getByRole('button', { name: 'Saltar vista previa' }).click()
    await expect(closingDialog(page)).toHaveCount(0)
    await dialog(page).getByRole('button', { name: 'Ver cierre' }).click()
    await expect(closingDialog(page)).toBeVisible()

    // Nothing was written, nothing was sent to Moodle, nothing was even read.
    expect(server.calls.slice(before)).toEqual([])
    expect(writes(server)).toEqual([])
    expect(await hostMessages(page)).toEqual([])
  })

  test('simulate not pass: the not-passed screen with the attempts a student would have', async ({
    page,
    context,
  }) => {
    const server = await open(page, context, { role: 'editor', mock: { maxAttempts: 3 } })
    await watchHostMessages(page)
    await tools(page).getByRole('button', { name: 'Simular no aprobar' }).click()
    await expect(banner(page)).toBeVisible()
    await expect(dialog(page).getByText('60.00 %', { exact: true }).first()).toBeVisible()
    await expect(
      dialog(page).getByText(/Este es tu punto de partida\. A partir de aquí vas a avanzar\./)
    ).toBeVisible()
    await expect(dialog(page).getByText('Intentos usados: 1 de 3')).toBeVisible()
    await expect(
      dialog(page).getByText(/el botón Cierre sigue como lo defina el curso/)
    ).toBeVisible()
    await expect(dialog(page).getByRole('button', { name: 'Ver cierre' })).toHaveCount(0)
    expect(writes(server)).toEqual([])
    expect(await hostMessages(page)).toEqual([])
  })

  test('simulate exactly 80 %: it does not pass, the rule is strictly above', async ({
    page,
    context,
  }) => {
    const server = await open(page, context, { role: 'editor' })
    await watchHostMessages(page)
    await tools(page).getByRole('button', { name: 'Simular justo 80 %' }).click()
    await expect(dialog(page).getByText('80.00 %', { exact: true }).first()).toBeVisible()
    await expect(
      dialog(page).getByText('Con exactamente 80 % no se aprueba: hay que superar el 80 %.')
    ).toBeVisible()
    await expect(dialog(page).getByText(/¡Felicidades!/)).toHaveCount(0)
    await expect(dialog(page).getByRole('button', { name: 'Ver cierre' })).toHaveCount(0)
    expect(writes(server)).toEqual([])
    expect(await hostMessages(page)).toEqual([])
  })

  test('the tools can switch between outcomes from the result screen', async ({
    page,
    context,
  }) => {
    await open(page, context, { role: 'editor' })
    await tools(page).getByRole('button', { name: 'Simular aprobar' }).click()
    await expect(dialog(page).getByText(/¡Felicidades!/)).toBeVisible()
    // The closing flow opened over it; leave it first.
    await closingDialog(page).getByRole('button', { name: 'Saltar vista previa' }).click()
    await dialog(page).getByRole('button', { name: 'Volver al mapa' }).first().click()
    await expect(tools(page)).toBeVisible()
    await tools(page).getByRole('button', { name: 'Simular no aprobar' }).click()
    await expect(dialog(page).getByText(/¡Felicidades!/)).toHaveCount(0)
  })

  test('with no closing flow configured it says so instead of offering Ver cierre', async ({
    page,
    context,
  }) => {
    await open(page, context, { role: 'editor', closingSteps: false })
    await tools(page).getByRole('button', { name: 'Simular aprobar' }).click()
    await expect(dialog(page).getByRole('button', { name: 'Ver cierre' })).toHaveCount(0)
    await expect(
      dialog(page).getByText('Este curso no tiene un flujo de cierre configurado.')
    ).toBeVisible()
    // Nothing opened over it: focus is on the result's heading.
    await expect(dialog(page).getByRole('heading', { name: 'Tu punto de partida' })).toBeFocused()
  })

  test('the final exam inside the closing preview has its own copy and no Ver cierre', async ({
    page,
    context,
  }) => {
    await open(page, context, { role: 'editor' })
    await tools(page).getByRole('button', { name: 'Simular aprobar' }).click()
    await closingDialog(page).getByRole('button', { name: 'Continuar' }).click()
    const panel = closingDialog(page).getByRole('region', {
      name: 'Herramientas de prueba · solo para editores',
    })
    await panel.getByRole('button', { name: 'Simular aprobar' }).click()
    await expect(
      closingDialog(page).getByText(/Aprobaste la evaluación final con 90.00 %/)
    ).toBeVisible()
    await expect(closingDialog(page).getByText(/diagnóstica/)).toHaveCount(0)
    await expect(closingDialog(page).getByRole('button', { name: 'Ver cierre' })).toHaveCount(0)
  })
})

test.describe('students never see the tools', () => {
  test('a student gets no panel, even when the backend says preview', async ({ page, context }) => {
    // The role gate on its own: the list says preview, the host says student.
    const server = await open(page, context, { role: 'student', mock: { preview: true } })
    await expect(
      dialog(page)
        .getByRole('button', { name: /^(Empezar la evaluación|Abrir)/ })
        .first()
    ).toBeVisible()
    await expect(page.locator('body')).not.toContainText('Herramientas de prueba')
    await expect(tools(page)).toHaveCount(0)
    expect(writes(server)).toEqual([])
  })

  test('an editor is not offered the tools when the backend says it is not a preview', async ({
    page,
    context,
  }) => {
    await open(page, context, { role: 'editor', mock: { preview: false } })
    await expect(tools(page)).toHaveCount(0)
    await expect(dialog(page).getByRole('button', { name: /Simular/ })).toHaveCount(0)
  })

  test('a student cannot reach the idle exam screen’s tools either', async ({ page, context }) => {
    await open(page, context, { role: 'student', mock: { preview: false } })
    await dialog(page)
      .getByRole('button')
      .filter({ hasText: /Empezar|Abrir|Continuar la/ })
      .first()
      .click()
    await expect(app(page).getByRole('button', { name: /Simular/ })).toHaveCount(0)
    await expect(app(page).getByText(/Herramientas de prueba/)).toHaveCount(0)
  })
})
