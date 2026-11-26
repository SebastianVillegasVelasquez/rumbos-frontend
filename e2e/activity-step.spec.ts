import { expect, test, type Page } from '@playwright/test'
import { app } from './support.ts'
import { closingStatus, enterFromCard, serveClosingStatus } from './closingStatus.ts'

// The Moodle-activity step (contract v5.11, plugin docs/HOST-CONTRACT.md) against the mock
// host, which plays the plugin. Branch-local: the plugin's contract is not merged yet, so the
// host messages are the ones its branch documents. Chromium and WebKit.

const closing = (steps: object[]) => ({
  enabled: true,
  title: null,
  message: null,
  video: null,
  playOnEnter: null,
  show: 'always',
  steps,
})

const activityStep = {
  type: 'moodle_activity',
  key: 'activity001',
  title: 'Guía de inicio',
  mandatory: true,
  revision: 1,
  cmid: 41,
}
const textStep = {
  type: 'html',
  key: 'closehtml1',
  title: 'Lo que lograste',
  mandatory: true,
  revision: 1,
  html: '<h2>Lo que lograste</h2><p>Terminaste el nivel.</p>',
  css: null,
  ack: null,
  minSeconds: 0,
}

const scenario = (page: Page, value: string) =>
  page.locator('label:has-text("activity scenario") select').selectOption(value)
const capability = (page: Page, value: 'full' | 'open only' | 'off') =>
  page.locator('label:has-text("activities capability") select').selectOption(value)

const load = async (page: Page, query: string) => {
  const input = page.locator('label:has-text("app URL") input')
  const current = await input.inputValue()
  await input.fill(`${current.split('?')[0]}?mockStableIds=1${query}`)
  await page.getByRole('button', { name: '(Re)load app' }).click()
  const level = app(page).getByRole('button', { name: /^1/ }).first()
  await level.waitFor({ timeout: 8000 })
  return level
}

const asJson = (value: object) => `&mockClosingJson=${encodeURIComponent(JSON.stringify(value))}`
const dialog = (page: Page) => app(page).getByRole('dialog', { name: 'Cierre', exact: true })
const next = (page: Page) => dialog(page).getByRole('button', { name: /^(Continuar|Terminar)$/ })
const card = (page: Page) =>
  dialog(page).getByRole('region', { name: 'Actividad del curso: Guía de inicio' })
const openButton = (page: Page) =>
  dialog(page).getByRole('button', { name: /^(Abrir|Abriendo…|Abrir de nuevo|Reintentar): Guía/ })

// A student reaching the closing flow whose first step is the activity.
const studentAtActivity = async (page: Page, steps: object[] = [activityStep, textStep]) => {
  await serveClosingStatus(page.context(), { value: closingStatus('required') })
  const level = await load(page, `&mockWelcome=disabled${asJson(closing(steps))}`)
  await level.click()
  const bubble = app(page).getByRole('dialog', { name: 'Bienvenida al curso' })
  await bubble.waitFor({ timeout: 8000 })
  await bubble.getByRole('button', { name: 'Cerrar' }).first().click()
  await app(page).getByRole('button', { name: 'Omitir' }).click()
  await expect(app(page).getByRole('dialog')).toHaveCount(0)
  await enterFromCard(page)
  await expect(dialog(page)).toBeVisible()
}

test.describe('activity step: the student', () => {
  test('opens the activity, waits for it to close, then lets them continue', async ({ page }) => {
    await page.goto('/mock-host/index.html')
    await scenario(page, 'opens, closes after 1 s')
    await studentAtActivity(page)
    await expect(dialog(page).getByRole('heading', { name: 'Guía de inicio' })).toBeVisible()
    await expect(next(page)).toHaveAttribute('aria-disabled', 'true')
    await expect(
      dialog(page).getByText(/Abre la actividad y ciérrala para continuar/)
    ).toBeVisible()

    await openButton(page).click()
    await expect(dialog(page).getByText('Ya viste esta actividad.')).toBeVisible({ timeout: 8000 })
    await expect(next(page)).toHaveAttribute('aria-disabled', 'false')
    // It can be opened again after being seen.
    await expect(openButton(page)).toHaveText(/Abrir de nuevo/)
    await next(page).click()
    await expect(dialog(page).getByRole('heading', { name: 'Lo que lograste' })).toBeVisible()
  })

  test('shows the waiting state with aria-busy, then says the host was silent and lets them retry', async ({
    page,
  }) => {
    await page.goto('/mock-host/index.html')
    await scenario(page, 'no answer')
    await studentAtActivity(page)
    await expect(card(page)).toHaveAttribute('aria-busy', 'false')
    await openButton(page).click()
    await expect(card(page)).toHaveAttribute('aria-busy', 'true')
    await expect(openButton(page)).toBeDisabled()
    await expect(dialog(page).getByText('Moodle no respondió. Inténtalo de nuevo.')).toBeVisible({
      timeout: 15_000,
    })
    await expect(card(page)).toHaveAttribute('aria-busy', 'false')
    await expect(openButton(page)).toHaveText(/Reintentar/)
    // The recorded way out is offered, and takes them on.
    await dialog(page).getByRole('button', { name: 'Continuar de todos modos' }).click()
    await expect(dialog(page).getByRole('heading', { name: 'Lo que lograste' })).toBeVisible()
  })

  test('an activity that is gone says "Actividad no disponible" and does not block', async ({
    page,
  }) => {
    await page.goto('/mock-host/index.html')
    await scenario(page, 'not_found')
    await studentAtActivity(page)
    await openButton(page).click()
    await expect(dialog(page).getByText(/^Actividad no disponible\./)).toBeVisible()
    await expect(openButton(page)).toHaveCount(0)
    await expect(next(page)).toHaveAttribute('aria-disabled', 'false')
    await expect(dialog(page).getByText(/not_found/)).toHaveCount(0)
  })

  test('forbidden can be retried and has the recorded way out', async ({ page }) => {
    await page.goto('/mock-host/index.html')
    await scenario(page, 'forbidden')
    await studentAtActivity(page)
    await openButton(page).click()
    await expect(
      dialog(page).getByText(
        'No tienes acceso a esta actividad en este momento. Inténtalo de nuevo.'
      )
    ).toBeVisible()
    await expect(openButton(page)).toHaveText(/Reintentar/)
    await expect(next(page)).toHaveAttribute('aria-disabled', 'true')
    // A retry that now works completes the step.
    await scenario(page, 'opens, closes after 1 s')
    await openButton(page).click()
    await expect(dialog(page).getByText('Ya viste esta actividad.')).toBeVisible({ timeout: 8000 })
    await expect(next(page)).toHaveAttribute('aria-disabled', 'false')
  })

  test('an unsupported module is told as such', async ({ page }) => {
    await page.goto('/mock-host/index.html')
    await scenario(page, 'unsupported')
    await studentAtActivity(page)
    await openButton(page).click()
    await expect(dialog(page).getByText(/no se puede abrir desde aquí/)).toBeVisible()
    await expect(next(page)).toHaveAttribute('aria-disabled', 'false')
  })

  test('a host without the capability gets a neutral message and no button', async ({ page }) => {
    await page.goto('/mock-host/index.html')
    await capability(page, 'off')
    await studentAtActivity(page)
    await expect(
      dialog(page).getByText(
        'Esta pantalla no puede abrir las actividades del curso. Puedes continuar.'
      )
    ).toBeVisible()
    await expect(openButton(page)).toHaveCount(0)
    await expect(
      dialog(page).getByRole('button', { name: 'Continuar de todos modos' })
    ).toHaveCount(0)
    await expect(next(page)).toHaveAttribute('aria-disabled', 'false')
  })

  test('focus goes to the open button, then the way on, and the page sends only a cmid', async ({
    page,
  }) => {
    await page.goto('/mock-host/index.html')
    await scenario(page, 'opens, never closes')
    await studentAtActivity(page)
    await openButton(page).focus()
    await page.keyboard.press('Enter')
    await expect(
      dialog(page).getByText('La actividad está abierta. Ciérrala para continuar.')
    ).toBeVisible()
    const log = await page.locator('#log').innerText()
    expect(log).toContain('rumbos:activity-open')
    expect(log).toMatch(/rumbos:activity-open[^\n]*cmid=41/)
    expect(log).not.toMatch(/rumbos:activity-open[^\n]*(url|href)/i)
    expect(log).not.toContain('Refused activity-open')
  })
})

const openClosingEditor = async (page: Page, steps: object[]) => {
  await page.locator('label:has-text("role") select').selectOption('editor')
  await page.locator('label:has-text("editing on") input').check()
  return async () => {
    const level = await load(page, asJson(closing(steps)))
    await level.click()
    await app(page)
      .getByRole('button', { name: /^Apariencia/ })
      .first()
      .click()
    await app(page).getByRole('button', { name: 'Cierre', exact: true }).first().click()
    return app(page)
  }
}

test.describe('activity step: the editor', () => {
  test('picks from the host list, names the step after it and flags a hidden activity', async ({
    page,
  }) => {
    await page.goto('/mock-host/index.html')
    const open = await openClosingEditor(page, [])
    const tab = await open()
    await tab.getByRole('button', { name: 'Actividad de Moodle', exact: true }).click()
    const picker = tab.getByLabel('Actividad del curso', { exact: true })
    await expect(picker).toBeVisible()
    // The step is not valid until an activity is chosen.
    await expect(tab.getByText('Elige una actividad.').first()).toBeVisible()
    await expect(picker.locator('option')).toHaveCount(4)
    await picker.selectOption({ label: 'Guía de inicio' })
    await expect(tab.getByText('Actividad elegida: Guía de inicio')).toBeVisible()
    await expect(tab.getByRole('textbox', { name: 'Título del paso' })).toHaveValue(
      'Guía de inicio'
    )
    // A hidden activity says what students will see.
    await picker.selectOption({ label: 'Enlace del museo (oculta para los estudiantes)' })
    await expect(tab.getByText(/Hazla visible en Moodle/)).toBeVisible()
    // The author's own title is kept.
    await tab.getByRole('textbox', { name: 'Título del paso' }).fill('Mi título')
    await picker.selectOption({ label: 'Lectura: la célula' })
    await expect(tab.getByRole('textbox', { name: 'Título del paso' })).toHaveValue('Mi título')
  })

  test('without the listing capability it asks for the cmid, with a warning', async ({ page }) => {
    await page.goto('/mock-host/index.html')
    await capability(page, 'open only')
    const open = await openClosingEditor(page, [])
    const tab = await open()
    await tab.getByRole('button', { name: 'Actividad de Moodle', exact: true }).click()
    await expect(tab.getByText(/no puede listar las actividades del curso/)).toBeVisible()
    const manual = tab.getByLabel('Número de la actividad (cmid)')
    await manual.fill('41')
    await expect(manual).toHaveValue('41')
    await expect(tab.getByText('Elige una actividad.')).toHaveCount(0)
    await manual.fill('0')
    await expect(tab.getByText('Elige una actividad.').first()).toBeVisible()
  })

  test('falls back to the cmid field when the host cannot list', async ({ page }) => {
    await page.goto('/mock-host/index.html')
    await scenario(page, 'list unavailable')
    const open = await openClosingEditor(page, [])
    const tab = await open()
    await tab.getByRole('button', { name: 'Actividad de Moodle', exact: true }).click()
    await expect(tab.getByText(/No pudimos leer las actividades del curso/)).toBeVisible()
    await expect(tab.getByLabel('Número de la actividad (cmid)')).toBeVisible()
  })

  test('reorders with the keyboard like any other step', async ({ page }) => {
    await page.goto('/mock-host/index.html')
    const open = await openClosingEditor(page, [textStep, activityStep])
    const tab = await open()
    const list = tab.locator('ol[aria-label="Flujo de cierre"] > li')
    await expect(list).toHaveCount(2)
    const up = tab.getByRole('button', { name: /^Subir paso: Guía de inicio/ })
    await up.focus()
    await page.keyboard.press('Enter')
    await expect(list.nth(0)).toContainText('Guía de inicio')
    await expect(list.nth(1)).toContainText('Lo que lograste')
  })

  test('the preview shows the activity card with the activity name', async ({ page }) => {
    await page.goto('/mock-host/index.html')
    await scenario(page, 'opens, closes after 1 s')
    const open = await openClosingEditor(page, [activityStep, textStep])
    const tab = await open()
    await tab.getByRole('button', { name: 'Probar el flujo' }).click()
    await expect(dialog(page).getByText('Vista previa: no se guarda nada.')).toBeVisible()
    await expect(card(page)).toBeVisible()
    await expect(dialog(page).getByText('Actividad de Moodle: Guía de inicio')).toBeVisible()
  })
})
