import { expect, test, type Page } from '@playwright/test'
import { app } from './support.ts'
import { hud, open, stage } from './trainerHarness.ts'

// The three answers the catalog can give, and the answers that are not any of them.
// Each used to be able to send the trainer to its error screen ("No pudimos cargar el
// entrenamiento") with a TypeError reading `find` of undefined; each now ends in a
// state the person can read, or in an explicit contract error with a way out. The
// bodies are the ones production sends.

const lesson = {
  id: '1.1',
  code: '1.1',
  title: 'Greetings and making introductions',
  description: 'Greet people and introduce yourself.',
  vocabulary_count: 8,
  activities: [
    {
      id: 'en-a1-1.1-dialogue',
      skill: 'dialogue',
      title: 'Talk it through 1.1',
      estimated_minutes: 5,
      publication_state: 'draft',
      step_count: 6,
      role: 'Receptionist welcoming a guest',
      can_do: ['I can greet a guest and say my name.'],
      state: 'not_started',
      best_percent: null,
    },
  ],
}
const enabled = (lessons: unknown[]) => ({
  enabled: true,
  language: 'en',
  level: 'A1',
  title: 'Inglés A1 · Turismo',
  content_version: 'cd21235a2e5ee4e4',
  modules: [{ key: 'M1', title: 'Asking for and giving personal information', lessons }],
})

// Everything the page reports as wrong while a test runs.
const watch = (page: Page) => {
  const problems: string[] = []
  page.on('pageerror', (error) => problems.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text())
  })
  return problems
}

const STAGE_CHUNK = '**/features/trainer/TrainerStage*'

test.describe('trainer catalog contract', () => {
  test('(a) disabled for the map: no button, no error', async ({ page, context }) => {
    const problems = watch(page)
    await open(page, context, {
      practice: { catalogBody: { enabled: false, reason: 'disabled_for_map' } },
    })
    await expect(app(page).getByRole('button', { name: 'Misiones' })).toBeVisible()
    await expect(hud(page)).toHaveCount(0)
    expect(problems).toEqual([])
  })

  test('(b) no published content: disabled with the reason, no error', async ({
    page,
    context,
  }) => {
    const problems = watch(page)
    await open(page, context, {
      practice: { catalogBody: { enabled: false, reason: 'no_published_content' } },
    })
    await expect(hud(page)).toHaveAttribute('aria-disabled', 'true')
    await expect(hud(page)).toHaveAccessibleDescription('Pronto habrá ejercicios disponibles')
    await hud(page).click({ force: true })
    await expect(stage(page)).toHaveCount(0)
    expect(problems).toEqual([])
  })

  test('(c) enabled with empty lessons: says there is no content yet, no error', async ({
    page,
    context,
  }) => {
    const problems = watch(page)
    await open(page, context, { practice: { catalogBody: enabled([]) } })
    await expect(hud(page)).toHaveAttribute('aria-disabled', 'true')
    await expect(hud(page)).toHaveAccessibleDescription('Pronto habrá ejercicios disponibles')
    await hud(page).click({ force: true })
    await expect(stage(page)).toHaveCount(0)
    expect(problems).toEqual([])
  })

  test('enabled with lessons opens, and an assessment list with no items does not break it', async ({
    page,
    context,
  }) => {
    const problems = watch(page)
    // The crash: { enabled: false } reached list.items.find inside the home screen.
    await open(page, context, {
      practice: { catalogBody: enabled([lesson]) },
      listBody: { enabled: false },
    })
    await hud(page).click()
    await stage(page).getByRole('button', { name: 'Entendido, empezar' }).click()
    await expect(stage(page).getByRole('button', { name: /Elige una lección/ })).toBeVisible()
    await expect(stage(page).getByText('No pudimos cargar el entrenamiento')).toHaveCount(0)
    await expect(stage(page).getByText('Evaluación final')).toHaveCount(0)
    expect(problems.filter((text) => /TypeError|could not be loaded/.test(text))).toEqual([])
  })

  test('a catalog the client cannot read is a contract error with a way out', async ({
    page,
    context,
  }) => {
    const problems = watch(page)
    // Enabled, but no modules: not one of the three answers.
    await open(page, context, { practice: { catalogBody: { enabled: true } } })
    await hud(page).click()
    const dialog = stage(page)
    await expect(dialog.getByRole('alert')).toContainText('No pudimos cargar el entrenamiento')
    await expect(dialog.getByRole('button', { name: 'Reintentar' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Volver al mapa' })).toBeVisible()
    // The cause is in the log, by endpoint and field; no TypeError anywhere.
    expect(
      problems.some((text) => text.includes('Contract violation at GET /trainer/catalog'))
    ).toBe(true)
    expect(problems.filter((text) => /TypeError/.test(text))).toEqual([])
    await dialog.getByRole('button', { name: 'Volver al mapa' }).click()
    await expect(stage(page)).toHaveCount(0)
  })

  test('a stage that cannot load offers Reintentar and Volver al mapa, and logs why', async ({
    page,
    context,
  }) => {
    const problems = watch(page)
    await open(page, context, {})
    // The stage's chunk will not download, as after a deploy that renamed it.
    await context.route(STAGE_CHUNK, (route) => route.abort('connectionfailed'))
    await hud(page).click()
    const failure = app(page).getByRole('alertdialog')
    await expect(failure.getByRole('alert')).toContainText('No pudimos cargar el entrenamiento')
    await expect
      .poll(() => problems.some((text) => text.includes('The trainer could not be loaded')))
      .toBe(true)

    // Reintentar, with the chunk back, opens the stage.
    await context.unroute(STAGE_CHUNK)
    await failure.getByRole('button', { name: 'Reintentar' }).click()
    await expect(stage(page)).toBeVisible({ timeout: 20_000 })
  })

  test('Volver al mapa from the failure screen leaves the map usable', async ({
    page,
    context,
  }) => {
    await open(page, context, {})
    await context.route(STAGE_CHUNK, (route) => route.abort('connectionfailed'))
    await hud(page).click()
    const failure = app(page).getByRole('alertdialog')
    await failure.getByRole('button', { name: 'Volver al mapa' }).click()
    await expect(failure).toHaveCount(0)
    await expect(app(page).getByRole('button', { name: 'Misiones' })).toBeVisible()
  })
})
