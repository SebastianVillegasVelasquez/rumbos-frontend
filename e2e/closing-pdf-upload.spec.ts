import { expect, test, type Page } from '@playwright/test'
import { app } from './support.ts'

// Adding a PDF step in the CLOSING editor. The upload is the welcome editor's (POST /assets,
// kind=document); the backend refuses a document without a title (invalid_asset_metadata),
// which the mock now does too, so a missing title can no longer hide behind it.

const closingEmpty = {
  enabled: true,
  title: null,
  message: null,
  video: null,
  playOnEnter: null,
  show: 'always',
  steps: [],
}

const pdf = {
  name: 'Guía de cierre.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Pages>>endobj\n2 0 obj<</Type /Page>>endobj\n%%EOF'
  ),
}

const openClosingEditor = async (page: Page, query = '') => {
  await page.goto('/mock-host/index.html')
  await page.locator('label:has-text("role") select').selectOption('editor')
  await page.locator('label:has-text("editing on") input').check()
  const input = page.locator('label:has-text("app URL") input')
  const current = await input.inputValue()
  await input.fill(
    `${current.split('?')[0]}?mockStableIds=1&mockClosingJson=${encodeURIComponent(JSON.stringify(closingEmpty))}${query}`
  )
  await page.getByRole('button', { name: '(Re)load app' }).click()
  const level = app(page).getByRole('button', { name: /^1/ }).first()
  await level.waitFor({ timeout: 8000 })
  await level.click()
  await app(page)
    .getByRole('button', { name: /^Apariencia/ })
    .first()
    .click()
  await app(page).getByRole('button', { name: 'Cierre', exact: true }).first().click()
  const tab = app(page)
  await tab.getByRole('button', { name: 'Documento PDF', exact: true }).click()
  await tab
    .getByRole('checkbox', { name: 'Declaro que tengo derecho a usar este documento.' })
    .check()
  return tab
}

test.describe('closing editor: the PDF step upload', () => {
  test('uploads a PDF with a title taken from its name and selects it', async ({ page }) => {
    const tab = await openClosingEditor(page)
    await tab.locator('input[type=file]').setInputFiles(pdf)
    const chooser = tab.getByLabel('Elige un documento ya subido')
    await expect(chooser).toHaveValue(/.+/)
    await expect(chooser.locator('option:checked')).toContainText('Guía de cierre')
    await expect(tab.getByText(/No se pudo subir/)).toHaveCount(0)
  })

  test('a failed upload says what to do, in Spanish, not the raw failure', async ({ page }) => {
    const tab = await openClosingEditor(page, '&mockAssets=down')
    await tab.locator('input[type=file]').setInputFiles(pdf)
    const message = tab.getByText(/No se pudo subir el documento\. Revisa tu conexión/)
    await expect(message).toBeVisible()
    await expect(tab.getByText(/invalid_asset_metadata|unknown_error|\b50\d\b/)).toHaveCount(0)
  })

  test('a full library says to free space', async ({ page }) => {
    const tab = await openClosingEditor(page, '&mockAssets=quota')
    await tab.locator('input[type=file]').setInputFiles(pdf)
    await expect(tab.getByText(/Se alcanzó el límite de archivos/)).toBeVisible()
  })
})
