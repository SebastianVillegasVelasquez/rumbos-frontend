import { expect, test, type Page } from '@playwright/test'
import { app } from './support.ts'

// "Tutor virtual" against the mock host, which plays contract v5.10: it announces
// capabilities.tutor only when asked to, and answers tutor-open with tutor-closed.

const open = async (page: Page, tutor: 'on' | 'off') => {
  await page.goto('/mock-host/index.html')
  await page.locator('label:has-text("tutor capability") select').selectOption(tutor)
  const input = page.locator('label:has-text("app URL") input')
  const current = await input.inputValue()
  await input.fill(`${current.split('?')[0]}?mockStableIds=1&mockWelcome=disabled`)
  await page.getByRole('button', { name: '(Re)load app' }).click()
  const level = app(page).getByRole('button', { name: /^1/ }).first()
  await level.waitFor({ timeout: 8000 })
  await level.click()
  // The demo map opens an info bubble on the first visit, then a guide: close both.
  const bubble = app(page).getByRole('dialog', { name: 'Bienvenida al curso' })
  await bubble.waitFor({ timeout: 8000 })
  await bubble.getByRole('button', { name: 'Cerrar' }).first().click()
  await app(page).getByRole('button', { name: 'Omitir' }).click()
  await expect(app(page).getByRole('dialog')).toHaveCount(0)
}

test.describe('Tutor virtual', () => {
  test('asks the host to open it, with no URL, and takes focus back when it closes', async ({
    page,
  }) => {
    await open(page, 'on')
    const button = app(page).getByRole('button', { name: /Tutor virtual/ })
    await expect(button).toBeVisible()
    await expect(button).toHaveAccessibleDescription('Asistente con inteligencia artificial')
    // The mock host may still be replacing the frame it first mounted: press again
    // until the message gets through.
    await expect(async () => {
      await button.press('Enter', { timeout: 2000 })
      await expect(page.locator('#log')).toContainText('app→host rumbos:tutor-open', {
        timeout: 1500,
      })
      // The host answers tutor-closed; the button gets focus back.
      await expect(button).toBeFocused({ timeout: 1500 })
    }).toPass({ timeout: 15000 })
    // The log prints every field after the type: there is none.
    await expect(page.locator('#log')).not.toContainText(/rumbos:tutor-open\s+\w+=/)
  })

  test('shows no button when the host does not announce the tutor', async ({ page }) => {
    await open(page, 'off')
    await expect(
      app(page)
        .getByRole('button', { name: /Entrenar|Misiones/ })
        .first()
    ).toBeVisible()
    await expect(app(page).getByRole('button', { name: /Tutor virtual/ })).toHaveCount(0)
  })
})
