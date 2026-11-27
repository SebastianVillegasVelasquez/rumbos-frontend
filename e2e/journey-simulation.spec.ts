import { expect, test, type BrowserContext, type Page, type Request } from '@playwright/test'
import { app } from './support.ts'
import { TrainerMock } from './trainerMock.ts'

// "Simular recorrido", the only simulator: both journeys from the welcome flow to their end, as
// an editor in Vista previa with editing on. A full run must do nothing: no request but GETs,
// and no message to the host that opens, records or changes anything.

const html = (key: string, title: string) => ({
  type: 'html',
  key,
  title,
  mandatory: true,
  revision: 1,
  html: `<h2>${title}</h2><p>Texto del paso.</p>`,
  css: null,
  ack: null,
  minSeconds: 0,
})
const activity = (key: string) => ({
  type: 'moodle_activity',
  key,
  title: 'Guía de inicio',
  mandatory: true,
  revision: 1,
  cmid: 41,
})
const quiz = (key: string) => ({
  type: 'quiz',
  key,
  title: 'Cuestionario del curso',
  mandatory: true,
  revision: 1,
  intro: 'Responde el cuestionario.',
  cmid: 42,
  outcomeAbove: null,
  outcomeBelow: null,
})
const exam = (key: string, purpose: 'check_in' | 'final', title: string) => ({
  type: 'assessment',
  key,
  title,
  mandatory: true,
  revision: 1,
  purpose,
})

const flow = (steps: object[]) => ({
  enabled: true,
  title: null,
  message: null,
  video: null,
  playOnEnter: null,
  show: 'always',
  steps,
})

const welcome = flow([
  html('welcomehtml', 'Antes de empezar'),
  activity('welcomeact1'),
  quiz('welcomequiz'),
  exam('welcomechk1', 'check_in', 'Evaluación de entrada'),
])
const closing = flow([
  html('closehtml1', 'Lo que lograste'),
  activity('closeact01'),
  exam('closefinal1', 'final', 'Evaluación final'),
])

// The host messages that only ask: capability, state and list reads, and the app's own
// start-up handshake. Anything else in a simulated run fails the test.
const READ_MESSAGES = [
  'rumbos:embed-ready',
  'rumbos:request-state',
  'rumbos:request-launch',
  'rumbos:request-stats',
  'rumbos:request-flow-progress',
  'rumbos:request-activities',
]

const watchHostMessages = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __messages: string[] }
    w.__messages = []
    window.addEventListener('message', (event) => {
      const type = (event.data as { type?: unknown } | null)?.type
      if (typeof type === 'string' && type.startsWith('rumbos:')) w.__messages.push(type)
    })
  })
const hostMessages = (page: Page) =>
  page.evaluate(() => (window as unknown as { __messages: string[] }).__messages)

const open = async (page: Page, context: BrowserContext, welcomeFlow: object = welcome) => {
  const server = new TrainerMock({ preview: true })
  await server.install(context)
  const statusReads: string[] = []
  await context.route(/\/trainer\/closing(\?.*)?$/, (route) => {
    statusReads.push(route.request().url())
    return route.abort()
  })
  await page.goto('/mock-host/index.html')
  await page
    .locator('label:has(select)')
    .filter({ hasText: /^role/ })
    .locator('select')
    .selectOption('editor')
  const input = page.locator('label:has-text("app URL") input')
  const base = (await input.inputValue()).split('?')[0]
  await input.fill(
    `${base}?mockStableIds=1&mockWelcomeJson=${encodeURIComponent(JSON.stringify(welcomeFlow))}&mockClosingJson=${encodeURIComponent(JSON.stringify(closing))}`
  )
  await page.getByRole('button', { name: '(Re)load app' }).click()
  const level = app(page).getByRole('button', { name: /^1/ }).first()
  await level.waitFor({ timeout: 8000 })
  await level.click()
  await app(page).getByRole('radio', { name: 'Vista previa', exact: true }).click()
  await expect(sim(page)).toBeVisible()

  // From here on, everything that leaves the app is recorded.
  await watchHostMessages(page)
  const writes: string[] = []
  context.on('request', (request: Request) => {
    if (request.method() !== 'GET') writes.push(`${request.method()} ${request.url()}`)
  })
  const callsBefore = server.calls.length
  const assertNoSideEffects = async () => {
    expect(writes).toEqual([])
    expect(server.calls.slice(callsBefore)).toEqual([])
    expect(statusReads).toEqual([])
    const unexpected = (await hostMessages(page)).filter((type) => !READ_MESSAGES.includes(type))
    expect(unexpected).toEqual([])
  }
  return { assertNoSideEffects }
}

const sim = (page: Page) => app(page).getByTestId('journey-simulator')
const press = (page: Page, name: string) => sim(page).getByRole('button', { name }).click()
const welcomeDialog = (page: Page) =>
  app(page).getByRole('dialog', { name: 'Bienvenida', exact: true })
const closingDialog = (page: Page) => app(page).getByRole('dialog', { name: 'Cierre', exact: true })
const forward = (dialog: ReturnType<typeof welcomeDialog>) =>
  dialog.getByRole('button', { name: /^(Continuar|Terminar)$/ })
const placeholder = 'En la simulación no se abre la actividad'
const openForReal = 'Abrir de verdad (registra una vista en tu cuenta de editor)'

// The welcome flow up to the check-in's idle screen, looking at every step on the way.
const walkToCheckin = async (page: Page) => {
  const dialog = welcomeDialog(page)
  await expect(dialog.getByRole('heading', { name: 'Antes de empezar' }).first()).toBeVisible()
  await forward(dialog).click()
  await expect(dialog.getByText(placeholder)).toBeVisible()
  await expect(dialog.getByRole('button', { name: openForReal })).toBeVisible()
  await forward(dialog).click()
  await expect(dialog.getByText('Responde el cuestionario.')).toBeVisible()
  await expect(dialog.getByText(placeholder)).toBeVisible()
  await forward(dialog).click()
  await expect(dialog.getByTestId('simulated-exam')).toBeVisible()
  // No way past the exam without a result, and no real exam to start.
  await expect(forward(dialog)).toBeDisabled()
  await expect(dialog.getByRole('button', { name: /^Empezar/ })).toHaveCount(0)
}

const sitCheckin = async (page: Page, choice: string) => {
  await welcomeDialog(page).getByRole('button', { name: choice }).click()
  await expect(welcomeDialog(page).getByTestId('simulation-banner')).toBeVisible()
  await forward(welcomeDialog(page)).click()
  await expect(welcomeDialog(page)).toHaveCount(0)
}

// To the closing's exam step, through the steps before it.
const walkToFinal = async (page: Page) => {
  const dialog = closingDialog(page)
  await expect(dialog.getByRole('heading', { name: 'Lo que lograste' }).first()).toBeVisible()
  await forward(dialog).click()
  await expect(dialog.getByText(placeholder)).toBeVisible()
  await forward(dialog).click()
}

test('check-in passed: congratulations, then the closing without the final', async ({
  page,
  context,
}) => {
  const { assertNoSideEffects } = await open(page, context)
  await press(page, 'Empezar simulación')
  await expect(sim(page).getByText('Simulación: no se guarda ni cuenta')).toBeVisible()
  await expect(sim(page).getByText('Se aprueba con más del 80 %.')).toBeVisible()
  await walkToCheckin(page)
  await sitCheckin(page, 'Simular aprobar')

  const screen = app(page).getByTestId('congratulations')
  await expect(screen).toBeVisible()
  await expect(screen).toHaveAttribute('data-simulated', 'true')
  await screen.getByRole('button', { name: 'Continuar' }).click()

  const dialog = closingDialog(page)
  await walkToFinalless(page)
  await forward(dialog).click()
  await expect(dialog).toHaveCount(0)
  await expect(sim(page).getByRole('button', { name: /Intento de la final/ })).toHaveCount(0)
  await assertNoSideEffects()
})

// The closing of a passed check-in: its last step is the activity, and there is no exam.
const walkToFinalless = async (page: Page) => {
  const dialog = closingDialog(page)
  await expect(dialog.getByRole('heading', { name: 'Lo que lograste' }).first()).toBeVisible()
  await expect(dialog.getByText(/Paso 1 de 2 · /)).toBeVisible()
  await forward(dialog).click()
  await expect(dialog.getByText(placeholder)).toBeVisible()
}

test('check-in failed: route, all done, three failed finals, reset, then a pass', async ({
  page,
  context,
}) => {
  const { assertNoSideEffects } = await open(page, context)
  await press(page, 'Empezar simulación')
  await walkToCheckin(page)
  await sitCheckin(page, 'Simular no aprobar')

  const route = app(page).getByTestId('route-card')
  await expect(route).toContainText('No alcanzaste el puntaje mínimo.')
  await route.getByRole('button', { name: 'Entendido' }).click()
  await expect(route).toHaveCount(0)

  // A bubble opens nothing: it says so.
  await app(page).getByRole('button', { name: 'Misiones', exact: true }).click()
  await app(page)
    .getByRole('button', { name: /^Abrir / })
    .first()
    .click()
  const notice = app(page).getByRole('alertdialog')
  await expect(notice).toContainText(placeholder)
  await expect(notice.getByRole('button', { name: openForReal })).toBeVisible()
  await notice.getByRole('button', { name: 'Cerrar' }).click()
  await app(page).getByRole('button', { name: 'Misiones', exact: true }).click()

  await press(page, 'Simular todas las actividades completadas')
  const card = app(page).getByTestId('closing-card')
  await expect(card).toContainText('Terminaste todo el contenido')

  // The first failure on the exam step itself.
  await card.getByRole('button', { name: 'Continuar al cierre' }).click()
  await walkToFinal(page)
  const dialog = closingDialog(page)
  await dialog.getByRole('button', { name: 'Simular no aprobar' }).click()
  await expect(dialog.getByRole('heading', { name: 'Intento 1 de 3: no aprobaste' })).toBeVisible()
  await expect(dialog.getByText('No aprobaste este intento. Te quedan 2 de 3.')).toBeVisible()
  await forward(dialog).click()
  await expect(dialog).toHaveCount(0)
  await expect(card).toContainText('Intento 1 de 3: no aprobaste')

  // The second from the panel, exactly on the threshold: it does not pass.
  await press(page, 'Intento de la final: justo 80 %')
  await expect(card).toContainText('Intento 2 de 3: no aprobaste')
  await expect(card).toContainText('Te quedan 1 de 3.')
  await press(page, 'Intento de la final: no aprobar')

  const exhausted = app(page).getByTestId('exhausted')
  await expect(exhausted).toContainText(
    'Agotaste tus intentos. Repasa el contenido del mapa y consulta con tu tutor.'
  )
  await expect(exhausted).not.toContainText(/reinici|desde el principio/i)
  await exhausted.getByRole('button', { name: 'Volver al mapa' }).click()
  await expect(sim(page).getByText('Intentos: 3 de 3')).toBeVisible()

  // Reset: no result, no attempt, nothing open, and the welcome flow again.
  await press(page, 'Reiniciar simulación')
  await walkToCheckin(page)
  await sitCheckin(page, 'Simular justo 80 %')
  await expect(sim(page).getByText('Diagnóstico: no aprobado')).toBeVisible()
  await expect(sim(page).getByText('Intentos: 0 de 3')).toBeVisible()
  await expect(app(page).getByTestId('exhausted')).toHaveCount(0)
  await press(page, 'Simular todas las actividades completadas')
  await press(page, 'Intento de la final: aprobar')
  await expect(app(page).getByTestId('congratulations')).toBeVisible()
  await assertNoSideEffects()
})

test('a reset closes an open closing flow, and so does leaving', async ({ page, context }) => {
  const { assertNoSideEffects } = await open(page, context)
  await press(page, 'Empezar simulación')
  await welcomeDialog(page).getByRole('button', { name: 'Ir a la evaluación' }).click()
  await sitCheckin(page, 'Simular aprobar')
  await app(page).getByTestId('congratulations').getByRole('button').click()
  await expect(closingDialog(page)).toBeVisible()
  await press(page, 'Reiniciar simulación')
  await expect(closingDialog(page)).toHaveCount(0)
  await expect(welcomeDialog(page)).toBeVisible()
  await press(page, 'Salir de la simulación')
  await expect(welcomeDialog(page)).toHaveCount(0)
  await expect(sim(page).getByRole('button', { name: 'Empezar simulación' })).toBeVisible()
  await assertNoSideEffects()
})

test('a welcome without a check-in gets one for the simulation, and says so', async ({
  page,
  context,
}) => {
  const { assertNoSideEffects } = await open(
    page,
    context,
    flow([html('welcomehtml', 'Antes de empezar')])
  )
  await press(page, 'Empezar simulación')
  await expect(sim(page).getByText(/se agrega solo en la simulación/)).toBeVisible()
  await welcomeDialog(page).getByRole('button', { name: 'Ir a la evaluación' }).click()
  await expect(welcomeDialog(page).getByTestId('simulated-exam')).toBeVisible()
  await assertNoSideEffects()
})

test('opening for real is a separate choice, and only it reaches the host', async ({
  page,
  context,
}) => {
  await open(page, context)
  await press(page, 'Empezar simulación')
  await forward(welcomeDialog(page)).click()
  await welcomeDialog(page).getByRole('button', { name: openForReal }).click()
  await expect.poll(() => hostMessages(page)).toContain('rumbos:activity-open')
})

test('a student is offered no simulator', async ({ page, context }) => {
  const server = new TrainerMock({ preview: true })
  await server.install(context)
  await page.goto('/mock-host/index.html')
  await page
    .locator('label:has(select)')
    .filter({ hasText: /^role/ })
    .locator('select')
    .selectOption('student')
  await page.getByRole('button', { name: '(Re)load app' }).click()
  const level = app(page).getByRole('button', { name: /^1/ }).first()
  await level.waitFor({ timeout: 8000 })
  await level.click()
  await expect(app(page).locator('canvas').first()).toBeVisible()
  await expect(sim(page)).toHaveCount(0)
  await expect(app(page).getByText('Simular recorrido')).toHaveCount(0)
})
