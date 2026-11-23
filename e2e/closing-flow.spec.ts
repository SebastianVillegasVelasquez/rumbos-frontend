import { expect, test, type Page } from '@playwright/test'
import { app } from './support.ts'

// The closing flow against the mock host and the draft closing shape of the mock API
// (branch-local until contracts/openapi.json declares it): the "Cierre" button, its
// states, the shared player and the gate on the final exam.

const closing = {
  enabled: true,
  title: null,
  message: null,
  video: null,
  playOnEnter: null,
  show: 'always',
  steps: [
    {
      type: 'html',
      key: 'closehtml1',
      title: 'Lo que lograste',
      mandatory: true,
      revision: 1,
      html: '<h2>Lo que lograste</h2><p>Terminaste el nivel.</p>',
      css: null,
      ack: null,
      minSeconds: 0,
    },
    {
      type: 'assessment',
      key: 'closefinal1',
      title: 'Evaluación final',
      mandatory: true,
      revision: 1,
      purpose: 'final',
    },
  ],
}

const open = async (page: Page, query: string) => {
  await page.goto('/mock-host/index.html')
  const input = page.locator('label:has-text("app URL") input')
  const current = await input.inputValue()
  await input.fill(`${current.split('?')[0]}?mockStableIds=1&mockWelcome=disabled${query}`)
  await page.getByRole('button', { name: '(Re)load app' }).click()
  const level = app(page).getByRole('button', { name: /^1/ }).first()
  await level.waitFor({ timeout: 8000 })
  await level.click()
  const bubble = app(page).getByRole('dialog', { name: 'Bienvenida al curso' })
  await bubble.waitFor({ timeout: 8000 })
  await bubble.getByRole('button', { name: 'Cerrar' }).first().click()
  await app(page).getByRole('button', { name: 'Omitir' }).click()
  await expect(app(page).getByRole('dialog')).toHaveCount(0)
}

const withClosing = `&mockClosingJson=${encodeURIComponent(JSON.stringify(closing))}`
const button = (page: Page) => app(page).getByRole('button', { name: 'Cierre', exact: true })
const dialog = (page: Page) => app(page).getByRole('dialog', { name: 'Cierre', exact: true })

test.describe('closing flow', () => {
  test('is opened by the student, never by itself, and the final exam gates Terminar', async ({
    page,
  }) => {
    await open(page, `${withClosing}&mockClosing=available`)
    await expect(button(page)).toHaveAttribute('aria-disabled', 'false')
    // Never over the map by itself.
    await expect(dialog(page)).toHaveCount(0)

    await button(page).click()
    await expect(dialog(page)).toBeVisible()
    await expect(dialog(page).getByRole('heading', { name: 'Lo que lograste' })).toBeVisible()
    await dialog(page).getByRole('button', { name: 'Continuar' }).click()

    // The final exam: the list is not served by this mock, so the step says it could not
    // load, offers Reintentar and keeps Terminar closed.
    await expect(dialog(page).getByText('No pudimos cargar la evaluación.')).toBeVisible({
      timeout: 20_000,
    })
    await expect(dialog(page).getByRole('button', { name: 'Reintentar' })).toBeVisible()
    await expect(dialog(page).getByRole('button', { name: 'Terminar' })).toHaveAttribute(
      'aria-disabled',
      'true'
    )
  })

  test('is closed, and says why, until the backend opens it', async ({ page }) => {
    await open(page, withClosing)
    await expect(button(page)).toHaveAttribute('aria-disabled', 'true')
    await button(page).click({ force: true })
    await expect(app(page).getByText('Todavía no puedes abrir el cierre.').first()).toBeVisible()
    await expect(dialog(page)).toHaveCount(0)
  })

  test('has no button when the map has no closing flow', async ({ page }) => {
    await open(page, '&mockClosing=available')
    await expect(app(page).getByRole('button', { name: 'Misiones' })).toBeVisible()
    await expect(button(page)).toHaveCount(0)
  })
})
