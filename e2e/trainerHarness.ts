import { expect, type BrowserContext, type Page } from '@playwright/test'
import { app, setFrameSize } from './support.ts'
import { TrainerMock, type MockOptions } from './trainerMock.ts'

// Shared by the trainer specs: the mock host with an app that has the trainer on,
// past the demo map's first-visit bubble and guide.

export const open = async (
  page: Page,
  context: BrowserContext,
  mock: MockOptions = {},
  {
    trainer = true,
    role,
    size,
  }: { trainer?: boolean; role?: 'editor'; size?: [number, number] } = {}
) => {
  const server = new TrainerMock(mock)
  await server.install(context)
  await page.goto('/mock-host/index.html')
  if (role === 'editor') {
    await page
      .locator('label:has(select)')
      .filter({ hasText: /^role/ })
      .locator('select')
      .selectOption('editor')
    await page
      .locator('label:has(input[type="checkbox"])')
      .filter({ hasText: /^editing on/ })
      .locator('input')
      .uncheck()
  }
  const input = page.locator('label:has-text("app URL") input')
  const current = await input.inputValue()
  await input.fill(
    `${current.split('?')[0]}?mockStableIds=1&mockWelcome=disabled${trainer ? '&mockTrainer=1' : ''}`
  )
  await page.getByRole('button', { name: '(Re)load app' }).click()
  if (size) await setFrameSize(page, size[0], size[1])
  const level = app(page).getByRole('button', { name: /^1/ }).first()
  await level.waitFor({ timeout: 8000 })
  await level.click()
  // The demo map opens an info bubble on the first visit, then a guide: close both.
  const bubble = app(page).getByRole('dialog', { name: 'Bienvenida al curso' })
  await bubble.waitFor({ timeout: 8000 })
  await bubble.getByRole('button', { name: 'Cerrar' }).first().click()
  await app(page).getByRole('button', { name: 'Omitir' }).click()
  await expect(app(page).getByRole('dialog')).toHaveCount(0)
  return server
}

export const hud = (page: Page) => app(page).getByRole('button', { name: 'Entrenar', exact: true })
export const stage = (page: Page) =>
  app(page).getByRole('dialog', { name: 'Entrenar', exact: true })
