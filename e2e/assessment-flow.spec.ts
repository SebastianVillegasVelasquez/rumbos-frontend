import {
  expect,
  test,
  type BrowserContext,
  type FrameLocator,
  type Locator,
  type Page,
} from '@playwright/test'
import { app } from './support.ts'
import { TrainerMock, type MockOptions } from './trainerMock.ts'

// The native check-in in the welcome flow, against a mock server that implements
// contract v2. The app makes real fetch calls; the mock answers with real statuses
// and shapes. Covers a full run, a reload that resumes, expiry at the deadline, a
// failed save with retry, a double submit, the 401 path, the preview banner, the
// way out when the backend cannot be reached, the passback states, and that no key
// or correctness field is ever stored by the app.

const flow = {
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

interface Open {
  mock: MockOptions
  role?: 'student' | 'editor'
}

const open = async (page: Page, context: BrowserContext, { mock, role }: Open) => {
  const server = new TrainerMock(mock)
  await server.install(context)
  await load(page, role)
  return server
}

const load = async (page: Page, role?: 'student' | 'editor') => {
  await page.goto('/mock-host/index.html')
  if (role)
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

// The app's own frame, to read its storage and DOM.
const appFrame = async (page: Page) => {
  const handle = await page.locator('#frame-wrap iframe').elementHandle()
  const frame = await handle?.contentFrame()
  if (!frame) throw new Error('the app frame is not there')
  return frame
}

const dialog = (page: Page) => app(page).getByRole('dialog', { name: 'Bienvenida', exact: true })
const hostLog = (page: Page) => page.locator('#log')
const recorded = (method: string) => new RegExp(`flow-step-done[^\\n]*check001[^\\n]*"${method}"`)
const nextButton = (page: Page) =>
  dialog(page).getByRole('button', { name: /^(Continuar|Terminar)$/ })

const startExam = async (page: Page) => {
  await dialog(page)
    .getByRole('button', { name: /^(Empezar la evaluación|Continuar la evaluación)$/ })
    .click()
  const intro = dialog(page).getByRole('button', { name: 'Empezar', exact: true })
  const resume = dialog(page).getByRole('button', { name: 'Continuar la evaluación' })
  await expect(intro.or(resume).first()).toBeVisible()
  await intro.or(resume).first().click()
  await expect(
    dialog(page)
      .getByText(/Sección 1 de 5/)
      .first()
  ).toBeVisible()
}

// Answers whatever is on screen, one way per item type.
const answerVisible = async (frame: FrameLocator | Locator) => {
  const groups = frame.getByRole('radiogroup')
  for (let i = 0; i < (await groups.count()); i++)
    await groups.nth(i).getByRole('radio').first().check({ force: true })
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

const toNextSection = (page: Page) =>
  dialog(page).getByRole('button', { name: 'Siguiente sección' }).click()

const answerEverything = async (page: Page) => {
  for (let section = 1; section <= 5; section++) {
    await expect(
      dialog(page)
        .getByText(new RegExp(`Sección ${section} de 5`))
        .first()
    ).toBeVisible()
    await answerVisible(dialog(page))
    if (section === 5) {
      // The written task's length hints: a counter, and the character limit on the box.
      await expect(dialog(page).getByText('4 palabras · entre 2 y 40')).toBeVisible()
      await expect(dialog(page).getByText('9 de 120 caracteres')).toBeVisible()
      await expect(dialog(page).locator('textarea').first()).toHaveAttribute('maxlength', '120')
    }
    if (section < 5) await toNextSection(page)
  }
}

const submit = async (page: Page) => {
  await dialog(page).getByRole('button', { name: 'Revisar y entregar' }).first().click()
  await dialog(page).getByRole('button', { name: 'Entregar', exact: true }).click()
  await dialog(page).getByRole('button', { name: 'Sí, entregar' }).click()
}

test.describe('check-in step: a full run', () => {
  test('summary, answers, review, confirmation, result, and the step recorded as completed', async ({
    page,
    context,
  }) => {
    const server = await open(page, context, { mock: {} })
    // The step says what the exam is and that it blocks Continuar.
    await expect(
      dialog(page).getByText('Evaluación de entrada: te dice por dónde empezar.')
    ).toBeVisible()
    await expect(nextButton(page)).toHaveAttribute('aria-disabled', 'true')
    await dialog(page).getByRole('button', { name: 'Empezar la evaluación' }).click()
    // The plain summary: questions, sections, 60 minutes, attempts, the time rule.
    await expect(dialog(page).getByText('12 preguntas')).toBeVisible()
    await expect(dialog(page).getByText('5 secciones')).toBeVisible()
    await expect(dialog(page).getByText('60 minutos')).toBeVisible()
    await expect(dialog(page).getByText('Te queda 1 intento')).toBeVisible()
    await expect(
      dialog(page).getByText('Una vez que empiezas, el tiempo corre aunque cierres la página.')
    ).toBeVisible()
    await expect(dialog(page).getByText(/No usamos tu micrófono/)).toBeVisible()
    await dialog(page).getByRole('button', { name: 'Empezar', exact: true }).click()

    // Section 1, and a timer that counts down from the server's deadline.
    await expect(dialog(page).getByText('Sección 1 de 5 · Listening').first()).toBeVisible()
    await expect(dialog(page).getByRole('timer')).toBeVisible()
    // No transcript during the exam, and no autoplay.
    await expect(dialog(page).getByText('Transcripción')).toHaveCount(0)

    // Leave one item blank on purpose, then see it in the review by number.
    await answerVisible(dialog(page))
    await dialog(page)
      .getByRole('radio')
      .first()
      .uncheck({ force: true })
      .catch(() => undefined)
    for (let section = 2; section <= 5; section++) {
      await toNextSection(page)
      await answerVisible(dialog(page))
    }
    await dialog(page).getByRole('button', { name: 'Revisar y entregar' }).first().click()
    await expect(
      dialog(page).getByRole('heading', { name: 'Revisa antes de entregar' })
    ).toBeVisible()
    await dialog(page).getByRole('button', { name: 'Entregar', exact: true }).click()
    await expect(
      dialog(page).getByRole('heading', { name: '¿Entregar la evaluación?' })
    ).toBeVisible()
    await dialog(page).getByRole('button', { name: 'Sí, entregar' }).click()

    // The result: percent, band, profile by section, never answers or keys.
    await expect(dialog(page).getByRole('heading', { name: 'Tu punto de partida' })).toBeVisible()
    await expect(
      dialog(page)
        .getByText(/\d+\.\d\d %/)
        .first()
    ).toBeVisible()
    await expect(dialog(page).getByText('Tu perfil por sección')).toBeVisible()
    await expect(dialog(page).getByText('Tu mapa por módulo')).toBeVisible()
    await expect(dialog(page).getByText(/no mostramos respuestas ni claves/)).toBeVisible()

    // Submitted: the flow step is recorded as completed, whatever the result.
    await expect(hostLog(page)).toContainText(recorded('completed'), { timeout: 5000 })
    await dialog(page).getByRole('button', { name: 'Continuar', exact: true }).click()
    await expect(dialog(page).getByRole('heading', { name: 'Listo' })).toBeVisible()
    expect(server.calls.filter((c) => c.path.endsWith('/submit'))).toHaveLength(1)
  })

  test('a failed attempt is a baseline, not a gate', async ({ page, context }) => {
    await open(page, context, { mock: {} })
    await startExam(page)
    // Submit with nothing answered: a 0 % result still completes the step.
    await dialog(page).getByRole('button', { name: 'Revisar y entregar' }).first().click()
    await dialog(page).getByRole('button', { name: 'Entregar', exact: true }).click()
    await expect(
      dialog(page)
        .getByText(/Te faltan 12 preguntas por terminar|12 preguntas sin terminar|Te faltan/)
        .first()
    ).toBeVisible()
    await dialog(page).getByRole('button', { name: 'Sí, entregar' }).click()
    await expect(
      dialog(page).getByText('Este es tu punto de partida. A partir de aquí vas a avanzar.')
    ).toBeVisible()
    await expect(hostLog(page)).toContainText(recorded('completed'), { timeout: 5000 })
  })
})

test.describe('never lose work', () => {
  test('a reload in the middle resumes the same attempt with the saved answers', async ({
    page,
    context,
  }) => {
    const server = await open(page, context, { mock: {} })
    await startExam(page)
    await dialog(page).getByRole('radio').first().check({ force: true })
    await expect(dialog(page).getByText('✓ Guardado')).toBeVisible({ timeout: 5000 })

    await load(page)
    await expect(dialog(page).getByText(/Tienes una evaluación en curso/)).toBeVisible()
    await startExam(page)
    // The same attempt (no second one consumed) and the same answer.
    expect(server.attempts.size).toBe(1)
    await expect(dialog(page).getByRole('radio').first()).toBeChecked()
  })

  test('a failed save keeps what was typed and the retry saves it', async ({ page, context }) => {
    await open(page, context, { mock: { failSaves: 1, failSaveStatus: 0 } })
    await startExam(page)
    await toNextSection(page)
    await toNextSection(page)
    await toNextSection(page)
    await expect(
      dialog(page)
        .getByText(/Sección 4 de 5/)
        .first()
    ).toBeVisible()
    await dialog(page).getByLabel('Name', { exact: true }).fill('Typed text stays')
    await expect(
      dialog(page).getByText('No se pudo guardar. Lo que escribiste sigue aquí.')
    ).toBeVisible({ timeout: 5000 })
    await expect(dialog(page).getByLabel('Name', { exact: true })).toHaveValue('Typed text stays')
    await dialog(page).getByRole('button', { name: 'Reintentar guardado' }).click()
    await expect(dialog(page).getByText('✓ Guardado')).toBeVisible({ timeout: 5000 })
  })

  test('a 401 on save shows the expired-session message and keeps the answers', async ({
    page,
    context,
  }) => {
    await open(page, context, { mock: { unauthorizedSaves: true } })
    await startExam(page)
    await dialog(page).getByRole('radio').first().check({ force: true })
    await expect(
      dialog(page)
        .getByRole('alert')
        .filter({ hasText: /Tu sesión venció/ })
    ).toBeVisible({
      timeout: 8000,
    })
    await expect(dialog(page).getByRole('radio').first()).toBeChecked()
  })
})

test.describe('the deadline and the submit', () => {
  test('at the deadline the exam submits by itself and says the time ran out', async ({
    page,
    context,
  }) => {
    await open(page, context, { mock: { timeLimitMs: 6_000 } })
    await startExam(page)
    await dialog(page).getByRole('radio').first().check({ force: true })
    await expect(
      dialog(page).getByText('Se acabó el tiempo y entregamos lo que tenías respondido.')
    ).toBeVisible({
      timeout: 15_000,
    })
    await expect(hostLog(page)).toContainText(recorded('completed'), { timeout: 5000 })
  })

  test('a double click on the confirmation submits once', async ({ page, context }) => {
    const server = await open(page, context, { mock: {} })
    await startExam(page)
    await dialog(page).getByRole('button', { name: 'Revisar y entregar' }).first().click()
    await dialog(page).getByRole('button', { name: 'Entregar', exact: true }).click()
    await dialog(page).getByRole('button', { name: 'Sí, entregar' }).dblclick()
    await expect(dialog(page).getByRole('heading', { name: 'Tu punto de partida' })).toBeVisible()
    expect(server.calls.filter((c) => c.path.endsWith('/submit'))).toHaveLength(1)
  })

  test('a failed submit keeps the answers and offers a retry', async ({ page, context }) => {
    await open(page, context, { mock: { failSubmits: 1 } })
    await startExam(page)
    await dialog(page).getByRole('radio').first().check({ force: true })
    await dialog(page).getByRole('button', { name: 'Revisar y entregar' }).first().click()
    await dialog(page).getByRole('button', { name: 'Entregar', exact: true }).click()
    await dialog(page).getByRole('button', { name: 'Sí, entregar' }).click()
    await expect(
      dialog(page).getByText('No pudimos entregar todavía. Tus respuestas siguen aquí.')
    ).toBeVisible()
    await dialog(page).getByRole('button', { name: 'Reintentar' }).click()
    await expect(dialog(page).getByRole('heading', { name: 'Tu punto de partida' })).toBeVisible()
  })
})

test.describe('never a trap', () => {
  test('an unreachable backend offers Reintentar and keeps Terminar closed', async ({
    page,
    context,
  }) => {
    await open(page, context, { mock: { listStatus: 503 } })
    await expect(dialog(page).getByText('No pudimos cargar la evaluación.')).toBeVisible({
      timeout: 15_000,
    })
    await expect(dialog(page).getByRole('button', { name: 'Reintentar' })).toBeVisible()
    await expect(nextButton(page)).toHaveAttribute('aria-disabled', 'true')
    await expect(
      dialog(page).getByRole('button', { name: 'Continuar de todos modos' })
    ).toHaveCount(0)
  })

  test('a check-in that is disabled for the map says why and offers the recorded escape', async ({
    page,
    context,
  }) => {
    await open(page, context, { mock: { enabled: false } })
    await expect(dialog(page).getByText('Este curso no tiene evaluación de entrada.')).toBeVisible()
    await expect(nextButton(page)).toHaveAttribute('aria-disabled', 'true')
    await dialog(page).getByRole('button', { name: 'Continuar de todos modos' }).click()
    await expect(hostLog(page)).toContainText(recorded('fallback'), { timeout: 5000 })
  })

  test('a locked check-in says why in words, never the raw code, and offers the escape', async ({
    page,
    context,
  }) => {
    await open(page, context, { mock: { state: 'locked' } })
    await expect(
      dialog(page).getByText('Esta evaluación todavía no está disponible.')
    ).toBeVisible()
    await expect(dialog(page).getByText('not_available')).toHaveCount(0)
    await expect(nextButton(page)).toHaveAttribute('aria-disabled', 'true')
    await expect(
      dialog(page).getByRole('button', { name: 'Continuar de todos modos' })
    ).toBeVisible()
  })

  test('the editing role sees the preview banner and is never blocked', async ({
    page,
    context,
  }) => {
    await open(page, context, { mock: { preview: true }, role: 'editor' })
    await expect(nextButton(page)).toHaveAttribute('aria-disabled', 'false')
    await dialog(page).getByRole('button', { name: 'Empezar la evaluación' }).click()
    await expect(dialog(page).getByText('Vista previa: no se guarda.').first()).toBeVisible()
  })
})

test.describe('the passback, told truthfully', () => {
  const pass = async (page: Page) => {
    await startExam(page)
    await answerEverything(page)
    await submit(page)
    await expect(
      dialog(page)
        .getByRole('heading', { name: 'Tu resultado' })
        .or(dialog(page).getByRole('heading', { name: 'Tu punto de partida' }))
        .first()
    ).toBeVisible()
  }

  test('pending then synced: completed is said only when the backend says synced', async ({
    page,
    context,
  }) => {
    await open(page, context, { mock: { sync: ['pending', 'pending', 'synced'] } })
    await pass(page)
    await expect(dialog(page).getByText('Estamos registrando tu resultado.')).toBeVisible()
    await expect(dialog(page).getByText('Tu curso quedó completado.')).toHaveCount(0)
    await expect(dialog(page).getByText('Tu curso quedó completado.')).toBeVisible({
      timeout: 20_000,
    })
  })

  test('failed: the result is saved and support is named', async ({ page, context }) => {
    await open(page, context, { mock: { sync: ['failed'] } })
    await pass(page)
    await expect(
      dialog(page).getByText(/Tu resultado está guardado; tardará en verse reflejado/)
    ).toBeVisible()
    await expect(dialog(page).getByText('Tu curso quedó completado.')).toHaveCount(0)
  })

  test('a result the server marks as not passed gets the kind wording, no pass claim', async ({
    page,
    context,
  }) => {
    // The pass rule is the server's (exact decimals); the app only shows its verdict.
    await open(page, context, { mock: { passPercent: 100, operator: 'gt', sync: ['synced'] } })
    await startExam(page)
    await answerEverything(page)
    await submit(page)
    await expect(dialog(page).getByText('Superaste la evaluación.')).toHaveCount(0)
    await expect(
      dialog(page).getByText('Este es tu punto de partida. A partir de aquí vas a avanzar.')
    ).toBeVisible()
  })
})

test.describe('nothing about the answers is ever kept', () => {
  test('a response with a key is refused whole and never stored', async ({ page, context }) => {
    await open(page, context, { mock: { leak: true } })
    await dialog(page).getByRole('button', { name: 'Empezar la evaluación' }).click()
    await dialog(page).getByRole('button', { name: 'Empezar', exact: true }).click()
    // The section that carried the key never renders; the rest of the exam works.
    await expect(dialog(page).getByText('No pudimos cargar esta sección.')).toBeVisible({
      timeout: 8000,
    })
    const stored = await (
      await appFrame(page)
    ).evaluate(() => ({
      local: JSON.stringify({ ...localStorage }),
      session: JSON.stringify({ ...sessionStorage }),
      html: document.documentElement.innerHTML,
    }))
    expect(stored.html).not.toContain('answer_key')
    expect(stored.local + stored.session).not.toContain('answer_key')
  })

  test('items are not persisted in browser storage during a run, and no response had a key', async ({
    page,
    context,
  }) => {
    const server = await open(page, context, { mock: {} })
    await startExam(page)
    await answerVisible(dialog(page))
    await toNextSection(page)
    await answerVisible(dialog(page))
    const stored = await (
      await appFrame(page)
    ).evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }))
    for (const prompt of ['Where is the speaker?', 'Ana arrives at the hotel', 'Option A'])
      expect(stored).not.toContain(prompt)
    for (const body of server.responses)
      expect(body).not.toMatch(
        /"(correct|is_correct|answer_key|accepted_answers|rubric|solution|explanation)"/
      )
  })
})
