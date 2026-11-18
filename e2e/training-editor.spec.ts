import { expect, test, type Page } from '@playwright/test'
import { routeForms } from './formsMock.ts'
import { app } from './support.ts'

// The editor's "Entrenamiento y evaluación" panel against the mock host (an editor
// with editing on) and the mock backend: both switches, the policy fields with their
// plain-language rule, the exemption warning, and a save through the studio's own
// Guardar button.

const openPanel = async (page: Page) => {
  await routeForms(page.context())
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

test.describe('training and assessments panel', () => {
  test('defaults to off, says the rule in words and warns about the exemption', async ({
    page,
  }) => {
    await openPanel(page)
    const panel = app(page)
    await expect(panel.getByRole('heading', { name: 'Entrenamiento y evaluación' })).toBeVisible()
    await expect(
      panel.getByRole('switch', { name: /Mostrar el botón «Entrenar»/ })
    ).not.toBeChecked()
    await expect(panel.getByRole('switch', { name: /Activar la evaluación/ })).not.toBeChecked()
    // The default rule, with the exact-mark edge spelled out.
    await expect(
      panel.getByText('Se aprueba con más de 80 %. Con exactamente 80 % no se aprueba.')
    ).toBeVisible()
    // The warning that a pass completes the course.
    await expect(panel.getByText(/completará el curso y recibirá el certificado/)).toBeVisible()
    // Language and level belong to the course, not the student; only A1 has content.
    await expect(panel.getByText('Lo define el curso, no el estudiante.')).toBeVisible()
    await expect(panel.getByRole('option', { name: 'B2 · sin contenido todavía' })).toBeDisabled()
  })

  test('edits the policy, clamps bad numbers and saves with Guardar', async ({ page }) => {
    await openPanel(page)
    const panel = app(page)
    await panel.getByRole('switch', { name: /Mostrar el botón «Entrenar»/ }).check()
    await panel.getByRole('switch', { name: /Activar la evaluación/ }).check()
    await panel.getByLabel('Nota para aprobar (%)').fill('85')
    await panel.getByLabel('Cómo se compara').selectOption('gte')
    await expect(panel.getByText('Se aprueba con 85 % o más.')).toBeVisible()
    // A value out of range is clamped, never saved invalid.
    await panel.getByLabel('Nota para aprobar (%)').fill('140')
    await expect(panel.getByLabel('Nota para aprobar (%)')).toHaveValue('100')
    await panel.getByLabel('Nota para aprobar (%)').fill('85')
    await panel.getByRole('switch', { name: /Dar el curso por completado/ }).uncheck()
    // The author chooses a form for each exam: with none, the save is refused.
    await panel
      .getByRole('group', { name: 'Evaluación de entrada' })
      .getByLabel('Formulario')
      .selectOption('a1-form-a')
    await panel
      .getByRole('group', { name: 'Evaluación final' })
      .getByLabel('Formulario')
      .selectOption('a1-form-a')
    await expect(panel.getByText(/completará el curso y recibirá el certificado/)).toHaveCount(0)
    // The studio's own panel (the publication bar has its own "Cambios sin guardar").
    const studio = panel.locator('.fixed.inset-y-0.right-0')
    await expect(studio.getByText('Cambios sin guardar', { exact: true })).toBeVisible()
    await studio.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(studio.getByText('Cambios sin guardar', { exact: true })).toHaveCount(0)
  })
})
