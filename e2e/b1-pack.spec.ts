import { expect, test, type Page } from '@playwright/test'
import { FOUR_LEVEL_FORMS, routeForms } from './formsMock.ts'
import { app } from './support.ts'
import { hud, open, stage } from './trainerHarness.ts'

// The English B1 pack through the endpoints A1, A2 and B2 already use (no contract change
// and no frontend change but the editor's list of levels). With the four levels in the same
// mock: the editor lists the four check-ins with the same title and tells them apart, B1 can
// be the course's level, a student sees the B1 catalog, a listening clip plays, and a clip
// that fails shows the recoverable error. Bodies are checked against contracts/openapi.json
// by the mocks.

const openEditorPanel = async (page: Page) => {
  await routeForms(page.context(), { forms: FOUR_LEVEL_FORMS })
  await page.goto('/mock-host/index.html')
  await page.locator('label:has-text("role") select').selectOption('editor')
  await page.locator('label:has-text("editing on") input').check()
  await page.getByRole('button', { name: '(Re)load app' }).click()
  const level = app(page).getByRole('button', { name: /^1/ }).first()
  await level.waitFor()
  await level.click()
  await app(page)
    .getByRole('button', { name: /^Apariencia/ })
    .first()
    .click()
  await app(page).getByRole('button', { name: 'Entrenamiento', exact: true }).click()
}

const startListening = async (page: Page) => {
  await hud(page).click()
  await expect(stage(page)).toBeVisible({ timeout: 20_000 })
  const accept = stage(page).getByRole('button', { name: 'Entendido, empezar' })
  const lessons = stage(page).getByRole('button', { name: 'Elige una lección' })
  await expect(accept.or(lessons).first()).toBeVisible()
  if (await accept.isVisible()) await accept.click()
  await lessons.click()
  await stage(page)
    .getByRole('button', { name: /^Abrir: Escucha: saludos/ })
    .click()
  await stage(page).getByRole('button', { name: 'Empezar', exact: true }).click()
  await expect(stage(page).getByRole('radio', { name: 'Good morning' })).toBeVisible()
}

test.describe('the B1 pack, with A1, A2 and B2', () => {
  test('the editor lists the four check-ins and tells them apart', async ({ page }) => {
    await openEditorPanel(page)
    const panel = app(page)
    // All four levels can be the course's level.
    for (const name of ['A1', 'A2', 'B1', 'B2'])
      await expect(panel.getByRole('option', { name, exact: true })).toBeEnabled()
    const checkIn = panel.getByRole('group', { name: 'Evaluación de entrada' })
    // Same title on all four: the level in front of each is what tells them apart, in order.
    await expect(checkIn.locator('option')).toHaveText([
      'Elige un formulario',
      'A1 · Evaluación de entrada — Forma A',
      'A2 · Evaluación de entrada — Forma A',
      'B1 · Evaluación de entrada — Forma A (borrador)',
      'B2 · Evaluación de entrada — Forma A',
    ])
    // With the trainer on at B1, the B1 form comes first and the rest sit under their own heading.
    await panel.getByRole('switch', { name: /Mostrar el botón «Entrenar»/ }).check()
    const level = panel.getByLabel('Nivel', { exact: true })
    await level.selectOption('B1')
    await expect(level).toHaveValue('B1')
    await expect(checkIn.locator('optgroup[label="Nivel del curso: B1"] option')).toHaveText([
      'B1 · Evaluación de entrada — Forma A (borrador)',
    ])
    await expect(
      checkIn.locator('optgroup[label="Otros niveles (el curso es B1)"] option')
    ).toHaveText([
      'A1 · Evaluación de entrada — Forma A',
      'A2 · Evaluación de entrada — Forma A',
      'B2 · Evaluación de entrada — Forma A',
    ])
    await checkIn.getByRole('combobox').selectOption('b1-form-a')
    await expect(checkIn.getByRole('combobox')).toHaveValue('b1-form-a')
  })

  test('a student sees the B1 catalog', async ({ page, context }) => {
    await open(page, context, { practice: { level: 'B1' } })
    await hud(page).click()
    await expect(stage(page)).toBeVisible({ timeout: 20_000 })
    const accept = stage(page).getByRole('button', { name: 'Entendido, empezar' })
    if (await accept.isVisible()) await accept.click()
    await expect(stage(page).getByText('Inglés B1 · Turismo')).toBeVisible()
    await stage(page).getByRole('button', { name: 'Elige una lección' }).click()
    await expect(stage(page).getByRole('heading', { name: /Módulo I/ })).toBeVisible()
    // The microphone is never asked for, at any level.
    await expect(stage(page).getByText(/micr[oó]fono/i)).toHaveCount(0)
  })

  test('a listening clip is fetched with the token and plays', async ({ page, context }, info) => {
    const server = await open(page, context, { practice: { level: 'B1' } })
    await startListening(page)
    await stage(page)
      .getByRole('button', { name: /^Escuchar/ })
      .first()
      .click()
    // The clip was asked for by fetch (with the bearer token), not by an <audio src>.
    await expect.poll(() => server.audioCalls).toBeGreaterThan(0)
    // WebKit in this Playwright build cannot decode audio: the click and the request are
    // asserted, the playing state only where the engine can play.
    if (info.project.name !== 'webkit') {
      await expect(
        stage(page)
          .getByRole('button', { name: /^Pausar/, pressed: true })
          .first()
      ).toBeVisible()
      await expect(stage(page).getByRole('alert').filter({ hasText: 'audio' })).toHaveCount(0)
    }
  })

  test('a clip that fails shows the recoverable error and plays on retry', async ({
    page,
    context,
  }, info) => {
    const server = await open(page, context, { practice: { level: 'B1' } })
    server.audioMissing = true
    await startListening(page)
    await expect(stage(page).getByText('No pudimos reproducir el audio.')).toBeVisible()
    const retry = stage(page).getByRole('button', { name: 'Reintentar el audio' }).first()
    await expect(retry).toBeVisible()
    // Still missing: the retry asks again and the error stays (never a silent dead player).
    const before = server.audioCalls
    await retry.click()
    await expect.poll(() => server.audioCalls).toBeGreaterThan(before)
    await expect(stage(page).getByText('No pudimos reproducir el audio.')).toBeVisible()
    // Back: the same retry now loads the clip and plays it. WebKit here cannot decode audio,
    // so there only the new request is asserted, not the error going away.
    server.audioMissing = false
    const missing = server.audioCalls
    await retry.click()
    await expect.poll(() => server.audioCalls).toBeGreaterThan(missing)
    if (info.project.name !== 'webkit')
      await expect(stage(page).getByText('No pudimos reproducir el audio.')).toHaveCount(0)
  })
})
