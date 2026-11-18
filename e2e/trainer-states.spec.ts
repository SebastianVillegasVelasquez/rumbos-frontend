import { expect, test } from '@playwright/test'
import { app } from './support.ts'
import { hud, open, stage } from './trainerHarness.ts'

// The "Entrenar" button and the stage for every answer the catalog can give: the
// button never offers a click that leads nowhere, and what it cannot do it says in
// words. The mock server answers each case with a real status and body.

const note = (page: Parameters<typeof hud>[0], text: string | RegExp) =>
  app(page).getByRole('status').filter({ hasText: text })

test.describe('trainer entry states', () => {
  test('loading: spinner, aria-busy, not pressable, then ready', async ({ page, context }) => {
    await open(page, context, { practice: { catalogDelayMs: 8000 } })
    await expect(hud(page)).toHaveAttribute('aria-busy', 'true')
    await expect(hud(page)).toHaveAttribute('aria-disabled', 'true')
    // Playwright waits on aria-disabled; a person can still press it.
    await hud(page).click({ force: true })
    await expect(note(page, 'Cargando el entrenamiento…')).toBeVisible()
    await expect(stage(page)).toHaveCount(0)
    // The catalog arrives: the button is a real button now.
    await expect(hud(page)).toHaveAttribute('aria-busy', 'false', { timeout: 15_000 })
    await expect(hud(page)).toHaveAttribute('aria-disabled', 'false')
    await hud(page).click()
    await expect(stage(page)).toBeVisible({ timeout: 20_000 })
  })

  test('disabled for the map: hidden for students', async ({ page, context }) => {
    await open(page, context, { practice: { enabled: false, reason: 'disabled_for_map' } })
    await expect(app(page).getByRole('button', { name: 'Misiones' })).toBeVisible()
    await expect(hud(page)).toHaveCount(0)
  })

  test('disabled for the map: an editor in preview sees why, as text', async ({
    page,
    context,
  }) => {
    await open(
      page,
      context,
      { practice: { enabled: false, reason: 'disabled_for_map', preview: true } },
      { role: 'editor' }
    )
    await expect(hud(page)).toHaveAttribute('aria-disabled', 'true')
    await expect(hud(page)).toHaveAttribute('aria-busy', 'false')
    await expect(note(page, 'El entrenamiento está desactivado en este mapa')).toBeVisible()
    await hud(page).click({ force: true })
    await expect(stage(page)).toHaveCount(0)
  })

  test('a backend without `reason` is treated as disabled for the map', async ({
    page,
    context,
  }) => {
    await open(page, context, { practice: { enabled: false } })
    await expect(hud(page)).toHaveCount(0)
  })

  test('no published content: disabled with the reason, pressing says it again', async ({
    page,
    context,
  }) => {
    await open(page, context, { practice: { enabled: false, reason: 'no_published_content' } })
    await expect(hud(page)).toHaveAttribute('aria-disabled', 'true')
    await expect(hud(page)).toHaveAttribute('aria-busy', 'false')
    await expect(hud(page)).toHaveAccessibleDescription('Pronto habrá ejercicios disponibles')
    await hud(page).click({ force: true })
    await expect(note(page, 'Pronto habrá ejercicios disponibles')).toBeVisible()
    await expect(stage(page)).toHaveCount(0)
  })

  test('no published content: an editor sees the reason without pressing', async ({
    page,
    context,
  }) => {
    await open(
      page,
      context,
      { practice: { enabled: false, reason: 'no_published_content', preview: true } },
      { role: 'editor' }
    )
    await expect(note(page, 'Pronto habrá ejercicios disponibles')).toBeVisible()
  })

  test('a 404 from the catalog means no trainer here: hidden, no dead click', async ({
    page,
    context,
  }) => {
    await open(page, context, { practice: { catalogStatus: 404 } })
    await expect(hud(page)).toHaveCount(0)
  })

  test('a server error: the stage says so, retries, and goes back to the map', async ({
    page,
    context,
  }) => {
    // The first load (two calls) and the stage's own (two more) fail; the retry works.
    await open(page, context, { practice: { catalogStatus: 503, catalogFailures: 4 } })
    await expect(hud(page)).toHaveAttribute('data-trainer-mode', 'error')
    await hud(page).click()
    const dialog = stage(page)
    await expect(dialog.getByRole('alert')).toHaveText('No pudimos cargar el entrenamiento.', {
      timeout: 20_000,
    })
    await expect(dialog.getByRole('button', { name: 'Volver al mapa' })).toBeVisible()
    await dialog.getByRole('button', { name: 'Reintentar' }).click()
    await expect(dialog.getByRole('heading', { name: 'Antes de empezar' })).toBeVisible({
      timeout: 20_000,
    })
    await expect(dialog.getByText('No pudimos cargar el entrenamiento.')).toHaveCount(0)
  })

  test('a dropped connection is the same error, with the same way out', async ({
    page,
    context,
  }) => {
    await open(page, context, { practice: { catalogStatus: 0 } })
    await hud(page).click()
    const dialog = stage(page)
    await expect(dialog.getByRole('alert')).toHaveText('No pudimos cargar el entrenamiento.', {
      timeout: 20_000,
    })
    await expect(dialog.getByRole('button', { name: 'Reintentar' })).toBeVisible()
    await dialog.getByRole('button', { name: 'Volver al mapa' }).click()
    await expect(stage(page)).toHaveCount(0)
    await expect(hud(page)).toBeFocused()
  })

  test('an editor in preview sees which items are not published', async ({ page, context }) => {
    await open(
      page,
      context,
      { practice: { unpublished: true, preview: true } },
      { role: 'editor' }
    )
    await hud(page).click()
    const dialog = stage(page)
    await dialog.getByRole('button', { name: 'Entendido, empezar' }).click({ timeout: 20_000 })
    await dialog.getByRole('button', { name: 'Elige una lección' }).click()
    await expect(
      dialog.getByText('Sin publicar: los estudiantes no lo verán').first()
    ).toBeVisible()
  })

  test('a student never sees publication states', async ({ page, context }) => {
    await open(page, context, { practice: { unpublished: true } })
    await hud(page).click()
    const dialog = stage(page)
    await dialog.getByRole('button', { name: 'Entendido, empezar' }).click({ timeout: 20_000 })
    await dialog.getByRole('button', { name: 'Elige una lección' }).click()
    await expect(dialog.getByText('Presentarse')).toBeVisible()
    await expect(dialog.getByText(/Sin publicar/)).toHaveCount(0)
  })

  test('the trainer code failing to download says so, with a retry and the way back', async ({
    page,
    context,
  }) => {
    await open(page, context)
    let blocked = true
    // The dev server serves the chunk as a module; the build serves a hashed file.
    await context.route(/TrainerStage/, (route) =>
      blocked ? route.abort('connectionfailed') : route.continue()
    )
    await hud(page).click()
    const failed = app(page).getByRole('alertdialog')
    await expect(failed.getByRole('alert')).toContainText('No pudimos cargar el entrenamiento', {
      timeout: 20_000,
    })
    // The map is still there behind it.
    await expect(app(page).getByRole('button', { name: 'Misiones' })).toBeAttached()
    await failed.getByRole('button', { name: 'Volver al mapa' }).click()
    await expect(failed).toHaveCount(0)
    await expect(hud(page)).toBeFocused()
    // Back online: pressing again loads it.
    blocked = false
    await hud(page).click()
    await expect(stage(page)).toBeVisible({ timeout: 20_000 })
  })
})
