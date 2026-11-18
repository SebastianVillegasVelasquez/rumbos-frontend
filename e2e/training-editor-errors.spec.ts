import { expect, test, type Page } from '@playwright/test'
import { routeForms } from './formsMock.ts'
import { app } from './support.ts'

// What the editor says when the trainer settings cannot be saved, against the mock
// host (an editor with editing on) and the mock backend, which answers like the
// contract: a 422 with errors[] { path, rule, message_key } and, on a save that goes
// through, warnings[]. Also the check-in step's dependency on the assessments, and
// the rule that no form is chosen for the author (the list comes from the backend and,
// when it cannot be had, the picker says so instead of offering a form of its own).

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

const openStudio = async (page: Page, extra = '', forms: { status?: number } = {}) => {
  await routeForms(page.context(), forms)
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
const formOf = (page: Page, group: 'Evaluación de entrada' | 'Evaluación final') =>
  studio(page).getByRole('group', { name: group }).getByLabel('Formulario')
const unsaved = (page: Page) => studio(page).getByText('Cambios sin guardar', { exact: true })
const issueList = (page: Page) =>
  studio(page).getByRole('alert').filter({ hasText: 'Corrige estos campos' })
const addCheckIn = (page: Page) =>
  studio(page).getByRole('button', { name: 'Evaluación de Rumbos (check-in)', exact: true }).click()
// The author's own choice, one purpose at a time: nothing picks it for them.
const chooseForms = async (page: Page) => {
  await formOf(page, 'Evaluación de entrada').selectOption('a1-form-a')
  await formOf(page, 'Evaluación final').selectOption('a1-form-a')
}

test.describe('the form is chosen, never defaulted', () => {
  test('when the list cannot be had, it says so and offers no form of its own', async ({
    page,
  }) => {
    await openStudio(page, '', { status: 503 })
    await goTo(page, 'Entrenamiento')
    await expect(
      studio(page)
        .getByText(/No pudimos cargar la lista de formularios/)
        .first()
    ).toBeVisible()
    for (const group of ['Evaluación de entrada', 'Evaluación final'] as const) {
      await expect(formOf(page, group)).toBeDisabled()
      await expect(formOf(page, group).locator('option')).toHaveText(['Elige un formulario'])
    }
  })

  test('starts with none selected and offers the forms the backend lists', async ({ page }) => {
    await openStudio(page)
    await goTo(page, 'Entrenamiento')
    for (const group of ['Evaluación de entrada', 'Evaluación final'] as const) {
      await expect(formOf(page, group)).toHaveValue('')
      await expect(formOf(page, group).locator('option')).toHaveText([
        'Elige un formulario',
        'A1 · Forma A',
        'A1 · Forma B (borrador)',
      ])
    }
  })

  test('switching the assessments on without a form is refused, naming each one', async ({
    page,
  }) => {
    await openStudio(page)
    await goTo(page, 'Entrenamiento')
    await assessmentsSwitch(page).check()
    await save(page).click()
    const list = issueList(page)
    await expect(
      list.getByRole('button', { name: 'Evaluación de entrada: falta elegir el formulario' })
    ).toBeVisible()
    await expect(
      list.getByRole('button', { name: 'Evaluación final: falta elegir el formulario' })
    ).toBeVisible()
    await expect(formOf(page, 'Evaluación de entrada')).toBeFocused()
    await expect(formOf(page, 'Evaluación de entrada')).toHaveAttribute('aria-invalid', 'true')
    await chooseForms(page)
    await expect(list).toHaveCount(0)
    await save(page).click()
    await expect(unsaved(page)).toHaveCount(0)
  })
})

test.describe('check-in step and its dependency', () => {
  test('offers both kinds and turns the assessments on, but leaves the form to the author', async ({
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
    await addCheckIn(page)
    // The dependency is said in the step, and so is what is still missing.
    await expect(studio(page).getByText(/Activamos las evaluaciones/)).toBeVisible()
    await expect(studio(page).getByText('Formulario: sin elegir todavía')).toBeVisible()
    // Saving now says why it cannot, instead of failing at the server.
    await save(page).click()
    await expect(
      issueList(page).getByRole('button', {
        name: 'Evaluación de entrada: falta elegir el formulario',
      })
    ).toBeVisible()
    await expect(formOf(page, 'Evaluación de entrada')).toBeFocused()
    await chooseForms(page)
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
    await addCheckIn(page)
    await goTo(page, 'Entrenamiento')
    await chooseForms(page)
    await assessmentsSwitch(page).uncheck()
    await save(page).click()
    const list = issueList(page)
    await expect(
      list.getByRole('button', { name: /^Evaluaciones: las evaluaciones están desactivadas/ })
    ).toBeVisible()
    await expect(assessmentsSwitch(page)).toBeFocused()
    await expect(assessmentsSwitch(page)).toHaveAttribute('aria-invalid', 'true')
    await expect(
      studio(page).getByText(/Error: las evaluaciones están desactivadas/)
    ).toBeAttached()
    await expect(unsaved(page)).toBeVisible()
    await expect(formOf(page, 'Evaluación de entrada')).toHaveValue('a1-form-a')
    await assessmentsSwitch(page).check()
    await expect(list).toHaveCount(0)
    await save(page).click()
    await expect(unsaved(page)).toHaveCount(0)
  })

  test('the step itself offers to switch them on again', async ({ page }) => {
    await openStudio(page)
    await goTo(page, 'Flujo de bienvenida')
    await addCheckIn(page)
    await goTo(page, 'Entrenamiento')
    await chooseForms(page)
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
  test('lists the failing field in words, focuses it and keeps what was chosen', async ({
    page,
  }) => {
    // The form was deleted after it was chosen: the server says so.
    await openStudio(page, '&mockFormsGone=1')
    await goTo(page, 'Entrenamiento')
    await assessmentsSwitch(page).check()
    await chooseForms(page)
    await save(page).click()

    const list = issueList(page)
    await expect(
      list.getByRole('button', {
        name: 'Evaluación de entrada: el formulario seleccionado no existe',
      })
    ).toBeVisible()
    await expect(studio(page).getByText(/422, trainer_settings_invalid/)).toHaveCount(0)

    const field = formOf(page, 'Evaluación de entrada')
    await expect(field).toBeFocused()
    await expect(field).toHaveAttribute('aria-invalid', 'true')
    await expect(field).toHaveAccessibleDescription(/el formulario seleccionado no existe/)
    await expect(field).toHaveValue('a1-form-a')
    await expect(unsaved(page)).toBeVisible()

    // Changing that field drops its error; the other one stays until fixed.
    await field.selectOption('')
    await expect(field).not.toHaveAttribute('aria-invalid', 'true')
    await expect(
      list.getByRole('button', { name: /^Evaluación de entrada: el formulario/ })
    ).toHaveCount(0)
    await expect(
      list.getByRole('button', { name: 'Evaluación final: el formulario seleccionado no existe' })
    ).toBeVisible()
  })

  test('the list takes you to the field, even from another tab', async ({ page }) => {
    await openStudio(page, '&mockFormsGone=1')
    await goTo(page, 'Entrenamiento')
    await assessmentsSwitch(page).check()
    await chooseForms(page)
    await save(page).click()
    const list = issueList(page)
    await expect(list).toBeVisible()
    await goTo(page, 'Flujo de bienvenida')
    await list.getByRole('button', { name: /^Evaluación de entrada: el formulario/ }).click()
    await expect(formOf(page, 'Evaluación de entrada')).toBeFocused()
  })
})

test.describe('a save with warnings', () => {
  test('goes through and says what the author should know, without blocking', async ({ page }) => {
    await openStudio(page, '&mockTrainerUnpublished=1')
    await goTo(page, 'Entrenamiento')
    await assessmentsSwitch(page).check()
    await chooseForms(page)
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
    await assessmentsSwitch(page).check()
    await chooseForms(page)
    await save(page).click()
    await expect(unsaved(page)).toHaveCount(0)
    await expect(studio(page).getByText('Se guardó, con avisos')).toHaveCount(0)
  })
})
