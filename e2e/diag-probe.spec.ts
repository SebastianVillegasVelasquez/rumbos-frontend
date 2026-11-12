import { expect, test } from '@playwright/test'

// The "Probar eventos de video" field of ?diag=1: nothing goes to the provider
// before the click, and after it the log shows what the player page says.
test('the video probe is silent until the click, then logs the player messages', async ({
  page,
  context,
}) => {
  const providerRequests: string[] = []
  await context.route('https://www.youtube-nocookie.com/**', (route) => {
    providerRequests.push(route.request().url())
    return route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><script>
        parent.postMessage(JSON.stringify({event:'onReady'}), '*')
        parent.postMessage(JSON.stringify({event:'onStateChange', info: 1}), '*')
      </script>`,
    })
  })
  await page.goto('/?diag=1')
  const panel = page.getByRole('region', { name: 'Diagnóstico' })
  await expect(panel.getByText('Probar eventos de video')).toBeVisible()
  await page.waitForTimeout(500)
  expect(providerRequests).toEqual([])

  await panel.getByLabel('Enlace o código del video').fill('jNQXAC9IVRw')
  await panel.getByRole('button', { name: 'Probar', exact: true }).click()
  await expect(panel.getByText(/iframe load/)).toBeVisible()
  expect(providerRequests.length).toBeGreaterThan(0)
  await expect(panel.getByRole('button', { name: 'Copiar registro' })).toBeVisible()
})
