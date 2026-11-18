import { expect, test, type Page } from '@playwright/test'
import { app } from './support.ts'

// What the editor says when the trainer settings cannot be saved, against the mock
// host (an editor with editing on) and the mock backend, which answers like the
// contract: a 422 with errors[] { path, rule, message_key } and, on a save that goes
// through, warnings[]. Also the check-in step's dependency on the assessments.

const welcomeWithoutSteps = encodeURIComponent(
  JSON.stringify({
    enabled: true,
    title: null,
    message: null,
    video: null,
    playOnEnter: null,
    show: 'first_visit',
    steps: [],
  })
)

const openStudio = async (page: Page, extra = '') => {
  await page.goto('/mock-host/index.html')
  await page.locator('label:has-text("role") select').selectOption('editor')
  await page.locator('label:has-text("editing on") input').check()
  const input = page.locator('label:has-text("app URL") input')
  const current = await input.inputValue()
  await input.fill(
    `${current.split('?')[0]}?mockTrainer=1&mockWelcomeJson=${welcomeWithoutSteps}${extra}`
  )
  await page.getByRole('button', { name: '(Re)load app' }).click()
  const level = app(page).getByRole('button', { name: /^1/ }).first()
  await level.waitFor()
  await level.click()
  await app(page)
    .getByRole('button', { name: /^Apariencia/ })
    .first()
    .click()
}

const studio = (page: Page) => app(page).locator('.fixed.inset-y-0.right-0')
const save = (page: Page) => studio(page).getByRole('button', { name: 'Guardar', exact: true })
const goTo = (page: Page, tab: string) =>
  studio(page).getByRole('button', { name: tab, exact: true }).click()
const assessmentsSwitch = (page: Page) =>
  studio(page).getByRole('switch', { name: /Activar la evaluación/ })
const checkInForm = (page: Page) =>
  studio(page).getByRole('group', { name: 'Evaluación de entrada' }).getByLabel('Formulario')
const unsaved = (page: Page) => studio(page).getByText('Cambios sin guardar', { exact: true })

test.describe('check-in step and its dependency', () => {
  test('offers both kinds and turns the assessments on when the check-in is added', async ({
    page,
  }) => {
    await openStudio(page)
    await goTo(page, 'Flujo de bienvenida')
    await expect(
      studio(page).getByRole('button', { name: 'Evaluación de Rumbos (check-in)', exact: true })
    ).toBeVisible()
    await expect(
      studio(page).getByRole('button', { name: 'Evaluación de Moodle', exact: true })
    ).toBeVisible()
    await studio(page)
      .getByRole('button', { name: 'Evaluación de Rumbos (check-in)', exact: true })
      .click()
    // The dependency is said in the step, with the form it will use.
    await expect(studio(page).getByText(/Activamos las evaluaciones/)).toBeVisible()
    await expect(studio(page).getByText('Formulario: forma_a')).toBeVisible()
    // And it saves: nothing fails without a reason.
    await save(page).click()
    await expect(unsaved(page)).toHaveCount(0)
    await goTo(page, 'Entrenamiento')
    await expect(assessmentsSwitch(page)).toBeChecked()
  })

  test('the Moodle quiz step does not change the assessments', async ({ page }) => {
    await openStudio(page)
    await goTo(page, 'Flujo de bienvenida')
    await studio(page).getByRole('button', { name: 'Evaluación de Moodle', exact: true }).click()
    await goTo(page, 'Entrenamiento')
    await expect(assessmentsSwitch(page)).not.toBeChecked()
  })

  test('with the assessments switched off, the save is blocked with the reason and the focus', async ({
    page,
  }) => {
    await openStudio(page)
    await goTo(page, 'Flujo de bienvenida')
    await studio(page)
      .getByRole('button', { name: 'Evaluación de Rumbos (check-in)', exact: true })
      .click()
    await goTo(page, 'Entrenamiento')
    await assessmentsSwitch(page).uncheck()
    await save(page).click()
    const list = studio(page).getByRole('alert').filter({ hasText: 'Corrige estos campos' })
    await expect(list).toBeVisible()
    await expect(
      list.getByRole('button', { name: /^Evaluaciones: las evaluaciones están desactivadas/ })
    ).toBeVisible()
    // The focus is on the field, which says it in text and not only by color.
    await expect(assessmentsSwitch(page)).toBeFocused()
    await expect(assessmentsSwitch(page)).toHaveAttribute('aria-invalid', 'true')
    await expect(
      studio(page).getByText(/Error: las evaluaciones están desactivadas/)
    ).toBeAttached()
    // What the author did is still there.
    await expect(unsaved(page)).toBeVisible()
    // Fixing the field clears its error.
    await assessmentsSwitch(page).check()
    await expect(list).toHaveCount(0)
    await save(page).click()
    await expect(unsaved(page)).toHaveCount(0)
  })

  test('the step itself offers to switch them on again', async ({ page }) => {
    await openStudio(page)
    await goTo(page, 'Flujo de bienvenida')
    await studio(page)
      .getByRole('button', { name: 'Evaluación de Rumbos (check-in)', exact: true })
      .click()
    await goTo(page, 'Entrenamiento')
    await assessmentsSwitch(page).uncheck()
    await goTo(page, 'Flujo de bienvenida')
    await studio(page)
      .getByRole('button', { name: /^Paso 1:/ })
      .click()
    await expect(studio(page).getByText(/este paso no se podrá guardar/)).toBeVisible()
    await studio(page).getByRole('button', { name: 'Activar las evaluaciones' }).click()
    await expect(studio(page).getByText(/este paso no se podrá guardar/)).toHaveCount(0)
    await save(page).click()
    await expect(unsaved(page)).toHaveCount(0)
  })
})

test.describe('a refused save', () => {
  test('lists the failing field in words, focuses it and keeps what was typed', async ({
    page,
  }) => {
    await openStudio(page)
    await goTo(page, 'Entrenamiento')
    await assessmentsSwitch(page).check()
    await checkInForm(page).fill('nope')
    await save(page).click()

    const list = studio(page).getByRole('alert').filter({ hasText: 'Corrige estos campos' })
    await expect(
      list.getByRole('button', {
        name: 'Evaluación de entrada: el formulario seleccionado no existe',
      })
    ).toBeVisible()
    // Not the old line that told nothing.
    await expect(studio(page).getByText(/422, trainer_settings_invalid/)).toHaveCount(0)

    // The first failing field has the focus and an error that is more than a color.
    await expect(checkInForm(page)).toBeFocused()
    await expect(checkInForm(page)).toHaveAttribute('aria-invalid', 'true')
    await expect(checkInForm(page)).toHaveAccessibleDescription(
      /el formulario seleccionado no existe/
    )
    await expect(
      studio(page).getByText('el formulario seleccionado no existe').last()
    ).toBeVisible()
    // What the author typed is still there, and still unsaved.
    await expect(checkInForm(page)).toHaveValue('nope')
    await expect(unsaved(page)).toBeVisible()

    // Correcting it clears the error and the next save goes through.
    await checkInForm(page).fill('forma_b')
    await expect(list).toHaveCount(0)
    await expect(checkInForm(page)).not.toHaveAttribute('aria-invalid', 'true')
    await save(page).click()
    await expect(unsaved(page)).toHaveCount(0)
  })

  test('the list takes you to the field, even from another tab', async ({ page }) => {
    await openStudio(page)
    await goTo(page, 'Entrenamiento')
    await assessmentsSwitch(page).check()
    await checkInForm(page).fill('nope')
    await save(page).click()
    const list = studio(page).getByRole('alert').filter({ hasText: 'Corrige estos campos' })
    await expect(list).toBeVisible()
    await goTo(page, 'Flujo de bienvenida')
    await list.getByRole('button', { name: /^Evaluación de entrada: el formulario/ }).click()
    await expect(checkInForm(page)).toBeFocused()
  })
})

test.describe('a save with warnings', () => {
  test('goes through and says what the author should know, without blocking', async ({ page }) => {
    await openStudio(page, '&mockTrainerUnpublished=1')
    await goTo(page, 'Entrenamiento')
    // The mock map already has the trainer on; the assessments are what changes.
    await assessmentsSwitch(page).check()
    await save(page).click()
    await expect(unsaved(page)).toHaveCount(0)
    const notice = studio(page).getByRole('status').filter({ hasText: 'Se guardó, con avisos' })
    await expect(notice).toBeVisible()
    await expect(
      notice.getByText('El contenido aún no está publicado: los estudiantes no lo verán.')
    ).toBeVisible()
    await notice.getByRole('button', { name: 'Cerrar' }).click()
    await expect(notice).toHaveCount(0)
  })

  test('says nothing when the save has no warnings', async ({ page }) => {
    await openStudio(page)
    await goTo(page, 'Entrenamiento')
    // The mock map already has the trainer on; the assessments are what changes.
    await assessmentsSwitch(page).check()
    await save(page).click()
    await expect(unsaved(page)).toHaveCount(0)
    await expect(studio(page).getByText('Se guardó, con avisos')).toHaveCount(0)
  })
})
