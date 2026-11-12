import { expect, test, type Page } from '@playwright/test'
import { app } from './support.ts'

// The welcome flow editor against the mock host (an editor with editing on) and
// the mock backend. It builds a flow through the interface, saves it, and checks
// what a student would get.

const openStudio = async (page: Page, query = '') => {
  await page.goto('/mock-host/index.html')
  await page.locator('label:has-text("role") select').selectOption('editor')
  await page.locator('label:has-text("editing on") input').check()
  const input = page.locator('label:has-text("app URL") input')
  const current = await input.inputValue()
  await input.fill(`${current.split('?')[0]}${query}`)
  await page.getByRole('button', { name: '(Re)load app' }).click()
  const level = app(page).getByRole('button', { name: /^1/ }).first()
  await level.waitFor()
  await level.click()
  await app(page)
    .getByRole('button', { name: /^Apariencia/ })
    .first()
    .click()
  await app(page)
    .getByRole('button', { name: /Flujo de bienvenida|Bienvenida/ })
    .first()
    .click()
}

const flowTab = (page: Page) => app(page)

test.describe('welcome flow editor', () => {
  test('a legacy welcome offers to convert into steps', async ({ page }) => {
    await openStudio(page, '?mockWelcome=video')
    await expect(flowTab(page).getByRole('button', { name: 'Convertir en pasos' })).toBeVisible()
    await flowTab(page).getByRole('button', { name: 'Convertir en pasos' }).click()
    await expect(flowTab(page).getByRole('list', { name: 'Flujo de bienvenida' })).toBeVisible()
    await expect(flowTab(page).getByRole('listitem')).toHaveCount(2)
  })

  test('builds a flow with the keyboard-reachable controls', async ({ page }) => {
    await openStudio(
      page,
      '?mockWelcomeJson=' +
        encodeURIComponent(
          JSON.stringify({
            enabled: true,
            title: null,
            message: null,
            video: null,
            playOnEnter: true,
            show: 'first_visit',
            steps: [],
          })
        )
    )
    const tab = flowTab(page)
    await tab.getByRole('button', { name: 'Mensaje de bienvenida', exact: true }).click()
    await tab.getByRole('button', { name: 'Texto con formato', exact: true }).click()
    await tab.getByRole('button', { name: 'Evaluación de Moodle', exact: true }).click()
    await expect(tab.locator('ol[aria-label="Flujo de bienvenida"] > li')).toHaveCount(3)

    // A second welcome step is refused, with the reason in visible text.
    await tab.getByRole('button', { name: 'Mensaje de bienvenida', exact: true }).click()
    await expect(tab.getByText('Ya hay un mensaje de bienvenida')).toBeVisible()

    // The quiz step: unlinked, with the fixed secure-window warning.
    await expect(tab.getByText(/ventana segura/)).toBeVisible()
    await expect(tab.getByText(/Hay pasos de evaluación sin vincular/)).toBeVisible()

    // Moving: the welcome step stays first.
    await expect(tab.getByRole('button', { name: /^Subir paso: Bienvenida/ })).toBeDisabled()
    await tab.getByRole('button', { name: /^Subir paso: Evaluación/ }).click()
    const titles = await tab.locator('ol[aria-label="Flujo de bienvenida"] > li').allInnerTexts()
    expect(titles[1]).toContain('Evaluación')
  })

  test('an html step starts from a template, previews sandboxed, and passes validation', async ({
    page,
  }) => {
    await openStudio(
      page,
      '?mockWelcomeJson=' +
        encodeURIComponent(
          JSON.stringify({
            enabled: true,
            title: null,
            message: null,
            video: null,
            playOnEnter: true,
            show: 'first_visit',
            steps: [],
          })
        )
    )
    const tab = flowTab(page)
    await tab.getByRole('button', { name: 'Texto con formato', exact: true }).click()
    await tab.getByLabel('Empezar desde una plantilla').selectOption('rules')
    await expect(tab.getByLabel('Contenido (HTML)')).toHaveValue(/Reglas del curso/)
    await expect(tab.getByLabel('Texto de la casilla')).toHaveValue('Leí y acepto las reglas')
    const preview = tab.locator('iframe[title="Así se verá"]')
    await expect(preview).toHaveAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox')
    await expect(tab.getByText(/problema/)).toHaveCount(0)

    // Forbidden markup is flagged before saving.
    await tab.getByLabel('Contenido (HTML)').fill('<script>alert(1)</script>')
    await expect(
      tab.getByText(/etiquetas o atributos que no se permiten|problema/).first()
    ).toBeVisible()
  })

  test('the fallback option warns, and a PDF upload needs the rights declaration', async ({
    page,
  }) => {
    await openStudio(
      page,
      '?mockWelcomeJson=' +
        encodeURIComponent(
          JSON.stringify({
            enabled: true,
            title: null,
            message: null,
            video: null,
            playOnEnter: true,
            show: 'first_visit',
            steps: [],
          })
        )
    )
    const tab = flowTab(page)
    await tab.getByRole('button', { name: 'Video', exact: true }).click()
    await tab.getByRole('checkbox', { name: /Ofrecer/ }).check()
    await expect(tab.getByText(/puede continuar sin haber visto el video/)).toBeVisible()

    await tab.getByRole('button', { name: 'Documento PDF', exact: true }).click()
    const file = {
      name: 'reglas.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(
        '%PDF-1.4\n1 0 obj<</Type/Pages>>endobj\n2 0 obj<</Type /Page>>endobj\n%%EOF'
      ),
    }
    await tab.locator('input[type=file]').setInputFiles(file)
    await expect(tab.getByText('Debes declarar que tienes derecho')).toBeVisible()
    await tab
      .getByRole('checkbox', { name: 'Declaro que tengo derecho a usar este documento.' })
      .check()
    await tab.locator('input[type=file]').setInputFiles(file)
    await expect(tab.getByLabel('Elige un documento ya subido')).toHaveValue(/.+/)
  })

  test('the reset button explains the editing mode and asks the host', async ({ page }) => {
    await openStudio(
      page,
      '?mockWelcomeJson=' +
        encodeURIComponent(
          JSON.stringify({
            enabled: true,
            title: null,
            message: null,
            video: null,
            playOnEnter: true,
            show: 'first_visit',
            steps: [],
          })
        )
    )
    const tab = flowTab(page)
    await expect(tab.getByText(/modo de edición activado/)).toBeVisible()
    await tab.getByRole('button', { name: 'Reiniciar mi progreso de bienvenida' }).click()
    await expect(page.locator('#log')).toContainText('rumbos:flow-reset')
    await expect(tab.getByText('Pedimos a Moodle que reinicie tu progreso.')).toBeVisible()
  })

  test('Probar el flujo previews without saving, and Guardar keeps the steps', async ({ page }) => {
    await openStudio(
      page,
      '?mockWelcomeJson=' +
        encodeURIComponent(
          JSON.stringify({
            enabled: true,
            title: null,
            message: null,
            video: null,
            playOnEnter: true,
            show: 'first_visit',
            steps: [],
          })
        )
    )
    const tab = flowTab(page)
    await tab.getByRole('button', { name: 'Mensaje de bienvenida', exact: true }).click()
    await tab.getByRole('button', { name: 'Probar el flujo' }).click()
    const dialog = app(page).getByRole('dialog', { name: 'Bienvenida', exact: true })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Vista previa: no se guarda nada.')).toBeVisible()
    await dialog.getByRole('button', { name: 'Saltar vista previa' }).click()
    await expect(dialog).toHaveCount(0)

    // The studio footer: Descartar and Guardar. Saving writes the draft.
    const dismiss = tab.getByRole('button', { name: 'Descartar', exact: true })
    await dismiss.locator('xpath=following-sibling::button').click()
    await expect(dismiss).toHaveCount(0)
    await expect(app(page).getByText('Cambios sin guardar').first()).toBeVisible()
    await expect(tab.locator('ol[aria-label="Flujo de bienvenida"] > li')).toHaveCount(1)
  })
})
