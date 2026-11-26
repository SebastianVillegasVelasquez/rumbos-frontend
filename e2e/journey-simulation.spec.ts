import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { app } from './support.ts'

// The editor's "Simular recorrido": both journeys played in memory over the student view, with
// the banner, the attempts and Reset. No status request is ever made for it.

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

const open = async (page: Page, context: BrowserContext) => {
  const requests: string[] = []
  await context.route(/\/trainer\/closing(\?.*)?$/, (route) => {
    requests.push(route.request().url())
    return route.abort()
  })
  await page.goto('/mock-host/index.html')
  await page
    .locator('label:has(select)')
    .filter({ hasText: /^role/ })
    .locator('select')
    .selectOption('editor')
  const input = page.locator('label:has-text("app URL") input')
  const base = (await input.inputValue()).split('?')[0]
  await input.fill(
    `${base}?mockStableIds=1&mockWelcome=disabled&mockClosingJson=${encodeURIComponent(JSON.stringify(closing))}`
  )
  await page.getByRole('button', { name: '(Re)load app' }).click()
  const level = app(page).getByRole('button', { name: /^1/ }).first()
  await level.waitFor({ timeout: 8000 })
  await level.click()
  await app(page).getByRole('radio', { name: 'Vista previa', exact: true }).click()
  return requests
}

const sim = (page: Page) => app(page).getByTestId('journey-simulator')

test('journey A in simulation: congratulations, then the closing without the final', async ({
  page,
  context,
}) => {
  const requests = await open(page, context)
  await sim(page).getByRole('button', { name: 'Aprobó el diagnóstico', exact: true }).click()
  await expect(sim(page).getByText('Simulación: no se guarda ni cuenta')).toBeVisible()
  const screen = app(page).getByTestId('congratulations')
  await expect(screen).toBeVisible({ timeout: 20_000 })
  await expect(screen).toHaveAttribute('data-simulated', 'true')
  await screen.getByRole('button', { name: 'Continuar' }).click()
  await expect(app(page).getByRole('dialog', { name: 'Cierre', exact: true })).toBeVisible()
  expect(requests).toHaveLength(0)
})

test('journey B in simulation: locked, content done, three failures, reset', async ({
  page,
  context,
}) => {
  await open(page, context)
  await sim(page).getByRole('button', { name: 'No aprobó el diagnóstico' }).click()
  await sim(page).getByRole('button', { name: 'Simular todas las actividades completadas' }).click()
  await expect(app(page).getByTestId('closing-card')).toBeVisible({ timeout: 20_000 })
  for (let i = 0; i < 3; i++)
    await sim(page).getByRole('button', { name: 'Intento de la final: no aprobar' }).click()
  await expect(sim(page).getByText('Intentos: 3 de 3')).toBeVisible()
  await expect(app(page).getByTestId('exhausted')).toBeVisible({ timeout: 20_000 })
  await app(page).getByTestId('exhausted').getByRole('button').click()
  await sim(page).getByRole('button', { name: 'Reiniciar simulación' }).click()
  await expect(sim(page).getByText('Intentos: 0 de 3')).toBeVisible()
  await expect(app(page).getByTestId('exhausted')).toHaveCount(0)
  await sim(page).getByRole('button', { name: 'Simular todas las actividades completadas' }).click()
  await sim(page).getByRole('button', { name: 'Intento de la final: aprobar' }).click()
  await expect(app(page).getByTestId('congratulations')).toBeVisible({ timeout: 20_000 })
})
