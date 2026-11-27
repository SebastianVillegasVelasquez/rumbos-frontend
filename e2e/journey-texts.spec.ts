import { expect, test, type Page } from '@playwright/test'
import { routeForms } from './formsMock.ts'
import { app } from './support.ts'

// The editor of the journey's texts (failure, exhausted and route instructions), against the
// mock host and the mock backend: the preview on the real cards, a save that keeps the texts,
// and the backend's refusal said in Spanish on its field.

const openStudio = async (page: Page) => {
  await routeForms(page.context(), {})
  await page.goto('/mock-host/index.html')
  await page.locator('label:has-text("role") select').selectOption('editor')
  await page.locator('label:has-text("editing on") input').check()
  const input = page.locator('label:has-text("app URL") input')
  const current = await input.inputValue()
  await input.fill(`${current.split('?')[0]}?mockTrainer=1`)
  await page.getByRole('button', { name: '(Re)load app' }).click()
  const level = app(page).getByRole('button', { name: /^1/ }).first()
  await level.waitFor()
  await level.click()
  await openTraining(page)
}

const studio = (page: Page) => app(page).getByRole('region', { name: 'Apariencia' })
const openTraining = async (page: Page) => {
  await app(page)
    .getByRole('button', { name: /^Apariencia/ })
    .first()
    .click()
  await studio(page).getByRole('button', { name: 'Entrenamiento', exact: true }).click()
}
const texts = (page: Page) => studio(page).getByRole('region', { name: 'Textos del recorrido' })
const block = (page: Page, name: RegExp) => texts(page).getByRole('group', { name }).first()
const failure = (page: Page) => block(page, /^Después de no aprobar/)
const exhausted = (page: Page) => block(page, /^Al agotar los intentos/)
const route = (page: Page) => block(page, /^En el mapa/)
const save = (page: Page) => studio(page).getByRole('button', { name: 'Guardar', exact: true })
const unsaved = (page: Page) => studio(page).getByText('Cambios sin guardar', { exact: true })

test('the three texts show on the real cards, are saved, and are still there afterwards', async ({
  page,
}) => {
  await openStudio(page)
  await failure(page).getByLabel('Título').fill('Casi')
  await failure(page)
    .getByLabel('Mensaje')
    .fill('Intento {attempt} de {attempts_max}: quedan {attempts_left}. Mínimo {threshold}.')
  await exhausted(page).getByLabel('Mensaje').fill('Habla con tu tutor.')
  await route(page).getByLabel('Texto del botón').fill('Vamos')

  // The preview fills the placeholders with the map's own rules.
  await expect(failure(page).getByTestId('failure-preview')).toContainText(
    /Intento 1 de 3: quedan 2\. Mínimo 80\./
  )
  await expect(exhausted(page).getByTestId('exhausted')).toContainText('Habla con tu tutor.')
  await expect(
    route(page).getByTestId('route-card').getByRole('button', { name: 'Vamos' })
  ).toBeVisible()

  await save(page).click()
  await expect(unsaved(page)).toHaveCount(0)

  // Leave the section and come back: the fields are read from the saved map.
  // The section's own way back comes first; the exhausted preview has a button of that name.
  await app(page).getByRole('button', { name: 'Volver al mapa' }).first().click()
  await openTraining(page)
  await expect(failure(page).getByLabel('Título')).toHaveValue('Casi')
  await expect(exhausted(page).getByLabel('Mensaje')).toHaveValue('Habla con tu tutor.')
  await expect(route(page).getByLabel('Texto del botón')).toHaveValue('Vamos')
  await expect(unsaved(page)).toHaveCount(0)
})

test('a refused text is said in Spanish, on its field', async ({ page }) => {
  await openStudio(page)
  const field = route(page).getByLabel('Mensaje')
  await field.fill('Mínimo {threshold}')
  await save(page).click()
  const list = studio(page).getByRole('alert').filter({ hasText: 'Corrige estos campos' })
  await expect(
    list.getByRole('button', {
      name: /^Texto de la ruta hacia la evaluación final: tiene una variable/,
    })
  ).toBeVisible()
  await expect(field).toBeFocused()
  await expect(field).toHaveAttribute('aria-invalid', 'true')
  await expect(studio(page).getByText(/journey_text/)).toHaveCount(0)
  await field.fill('Recorre el mapa.')
  await expect(list).toHaveCount(0)
  await save(page).click()
  await expect(unsaved(page)).toHaveCount(0)
})
