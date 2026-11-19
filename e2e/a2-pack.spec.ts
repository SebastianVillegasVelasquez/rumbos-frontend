import { expect, test, type Page } from '@playwright/test'
import { A2_FORMS, routeForms } from './formsMock.ts'
import { app } from './support.ts'
import { hud, open, stage } from './trainerHarness.ts'

// The English A2 pack through the endpoints A1 already uses (the backend changed no
// contract for it). The editor's picker lists the A2 form with its state and the level can
// be set to A2; a student sees the A2 catalog; a listening clip is fetched and played, and a
// clip that fails shows the recoverable error and plays on retry. Bodies are checked against
// contracts/openapi.json by the mocks.

const openEditorPanel = async (page: Page) => {
  await routeForms(page.context(), { forms: A2_FORMS })
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

test.describe('the A2 pack', () => {
  test('the editor lists the A2 form, with its state, and can set the level to A2', async ({
    page,
  }) => {
    await openEditorPanel(page)
    const panel = app(page)
    await expect(panel.getByRole('option', { name: 'A2', exact: true })).toBeEnabled()
    await expect(panel.getByRole('option', { name: 'B2 · sin contenido todavía' })).toBeDisabled()
    const level = panel.getByLabel('Nivel', { exact: true })
    await level.selectOption('A2')
    await expect(level).toHaveValue('A2')
    const checkIn = panel.getByRole('group', { name: 'Evaluación de entrada' })
    await expect(checkIn.locator('option')).toHaveText([
      'Elige un formulario',
      'A1 · Evaluación de entrada — A1 · Forma A',
      'A1 · Evaluación de entrada — A1 · Forma B (borrador)',
      'A2 · Evaluación de entrada — A2 · Forma A (borrador)',
    ])
    await checkIn.getByRole('combobox').selectOption('a2-form-a')
    await expect(checkIn.getByRole('combobox')).toHaveValue('a2-form-a')
  })

  test('a student sees the A2 catalog', async ({ page, context }) => {
    await open(page, context, { practice: { level: 'A2' } })
    await hud(page).click()
    await expect(stage(page)).toBeVisible({ timeout: 20_000 })
    const accept = stage(page).getByRole('button', { name: 'Entendido, empezar' })
    if (await accept.isVisible()) await accept.click()
    await expect(stage(page).getByText('Inglés A2 · Turismo')).toBeVisible()
    await stage(page).getByRole('button', { name: 'Elige una lección' }).click()
    await expect(stage(page).getByRole('heading', { name: /Módulo I/ })).toBeVisible()
    // The microphone is never asked for, at any level.
    await expect(stage(page).getByText(/micr[oó]fono/i)).toHaveCount(0)
  })

  test('a listening clip is fetched with the token and plays', async ({ page, context }, info) => {
    const server = await open(page, context, { practice: { level: 'A2' } })
    await startListening(page)
    const listen = stage(page)
      .getByRole('button', { name: /^Escuchar/ })
      .first()
    await listen.click()
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
  }) => {
    const server = await open(page, context, { practice: { level: 'A2' } })
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
    // Back: the same retry now loads and plays the clip.
    server.audioMissing = false
    await retry.click()
    await expect(stage(page).getByText('No pudimos reproducir el audio.')).toHaveCount(0)
  })
})
