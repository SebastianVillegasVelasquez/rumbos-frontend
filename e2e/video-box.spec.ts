import { expect, test } from '@playwright/test'
import {
  MOODLE_CELLS,
  VIEWPORTS,
  ZOOMS,
  app,
  describeProbe,
  openLevel,
  probe,
  problem,
  routeProvider,
  setFrameSize,
  type Surrogate,
} from './support.ts'

// The welcome video panel must keep a usable size and 16:9 at every viewport.
// One test per state loops over the whole matrix and reports every bad cell.

const cells = () => [
  ...VIEWPORTS.flatMap(([w, h]) =>
    // A phone has no page zoom that shrinks the layout viewport (pinch does not).
    (w < 600 ? [1] : ZOOMS).map((z) => ({
      name: `${w}x${h}@${Math.round(z * 100)}%`,
      w: Math.round(w / z),
      h: Math.round(h / z),
    }))
  ),
  ...MOODLE_CELLS.map(([w, h]) => ({ name: `moodle ${w}x${h}`, w, h })),
]

const sweep = async (page: Parameters<typeof probe>[0]) => {
  const bad: string[] = []
  const table: string[] = []
  for (const cell of cells()) {
    await setFrameSize(page, cell.w, cell.h)
    const p = await probe(page)
    const line = `${cell.name.padEnd(20)} ${describeProbe(p)}`
    table.push(line)
    const why = problem(p)
    if (why) bad.push(`${line}  <-- ${why}`)
  }
  test.info().annotations.push({ type: 'table', description: table.join('\n') })
  return bad
}

test('before the click the curtain offers the primary button and no video panel', async ({
  page,
  context,
}) => {
  await routeProvider(context, 'small')
  await openLevel(page)
  await expect(app(page).getByRole('button', { name: 'Reproducir' })).toBeVisible()
  expect((await probe(page)).hasPanel).toBe(false)
})

for (const surrogate of ['small', 'tall', 'blocked'] as const satisfies Surrogate[]) {
  test(`after the click, provider ${surrogate}: the panel keeps size and 16:9`, async ({
    page,
    context,
  }) => {
    await routeProvider(context, surrogate)
    await openLevel(page)
    await app(page).getByRole('button', { name: 'Reproducir' }).click()
    await expect(app(page).locator('[role=dialog] iframe')).toBeAttached()
    const bad = await sweep(page)
    expect(bad, `bad cells:\n${bad.join('\n')}`).toEqual([])
  })
}

test('the video opened from the optional button gets the same panel', async ({ page, context }) => {
  await routeProvider(context, 'small')
  await openLevel(page, 'video-optional')
  await app(page).getByRole('button', { name: 'Ver video de bienvenida' }).click()
  await expect(app(page).locator('[role=dialog] iframe')).toBeAttached()
  const bad = await sweep(page)
  expect(bad, `bad cells:\n${bad.join('\n')}`).toEqual([])
})

for (const [w, h] of VIEWPORTS) {
  test(`host fullscreen at ${w}x${h}: the panel keeps size and 16:9`, async ({ page, context }) => {
    await routeProvider(context, 'small')
    await page.setViewportSize({ width: w, height: h })
    await openLevel(page)
    await app(page).getByRole('button', { name: 'Reproducir' }).click()
    await app(page).getByRole('dialog').getByRole('button', { name: 'Pantalla completa' }).click()
    await expect(page.locator('#frame-wrap.fullscreen')).toBeVisible()
    await page.waitForTimeout(300)
    const p = await probe(page)
    expect(problem(p), describeProbe(p)).toBeNull()
  })
}

test.describe('video mode on a short viewport', () => {
  test('the curtain scrolls instead of squeezing and keeps its controls', async ({
    page,
    context,
  }) => {
    await routeProvider(context, 'small')
    await openLevel(page)
    await app(page).getByRole('button', { name: 'Reproducir' }).click()
    await expect(app(page).locator('[role=dialog] iframe')).toBeAttached()
    await setFrameSize(page, 1100, 240)

    const dialog = app(page).getByRole('dialog')
    // The footnote ("Video alojado en ...") gives way to the video...
    await expect(dialog.getByText(/Video alojado/)).toHaveCount(0)
    // ...but the controls that are always needed stay reachable.
    const skip = dialog.getByRole('button', { name: 'Saltar' })
    await skip.scrollIntoViewIfNeeded()
    await expect(skip).toBeInViewport()
    const fullscreen = dialog.getByRole('button', { name: 'Pantalla completa' })
    await fullscreen.scrollIntoViewIfNeeded()
    await expect(fullscreen).toBeInViewport()

    const scroller = await dialog.locator(':scope > div.relative').evaluate((el) => {
      const style = getComputedStyle(el)
      return {
        overflowY: style.overflowY,
        supported: CSS.supports('overscroll-behavior', 'contain'),
        overscroll:
          style.getPropertyValue('overscroll-behavior-y') ||
          style.getPropertyValue('overscroll-behavior'),
        scrollable: el.scrollHeight > el.clientHeight,
      }
    })
    expect(scroller.overflowY).toBe('auto')
    // Progressive enhancement: an engine without it simply scrolls the page behind.
    if (scroller.supported) expect(scroller.overscroll).toBe('contain')
    expect(scroller.scrollable).toBe(true)
  })

  test('there is no "Ampliar video" button; fullscreen is the native player fullscreen', async ({
    page,
    context,
  }) => {
    await routeProvider(context, 'small')
    await openLevel(page)
    await app(page).getByRole('button', { name: 'Reproducir' }).click()
    await expect(app(page).locator('[role=dialog] iframe')).toBeAttached()
    await expect(app(page).getByRole('button', { name: /Ampliar video|Reducir/ })).toHaveCount(0)
    // Same single sizing path after a wait longer than the entrance animation.
    await page.waitForTimeout(700)
    const p = await probe(page)
    expect(problem(p), describeProbe(p)).toBeNull()
  })
})

// The curtain never traps the viewer: "Empezar viaje" is reachable with the
// video loading, playing or blocked, at the smallest viewport, by keyboard.
test.describe('the way out of the video', () => {
  for (const surrogate of ['small', 'blocked'] as const satisfies Surrogate[]) {
    test(`provider ${surrogate}: Empezar viaje is visible and reachable by keyboard at 360x640`, async ({
      page,
      context,
    }) => {
      await routeProvider(context, surrogate)
      await openLevel(page)
      await app(page).getByRole('button', { name: 'Reproducir' }).click()
      await setFrameSize(page, 360, 640)
      const start = app(page).getByRole('dialog').getByRole('button', { name: 'Empezar viaje' })
      await start.scrollIntoViewIfNeeded()
      await expect(start).toBeInViewport()

      let reached = false
      for (let i = 0; i < 8 && !reached; i++) {
        await page.keyboard.press('Tab')
        reached = await start.evaluate((el) => el === el.ownerDocument.activeElement)
      }
      expect(reached, 'Tab never reached "Empezar viaje"').toBe(true)

      await page.keyboard.press('Enter')
      await expect(app(page).getByRole('dialog')).toHaveCount(0)
    })
  }

  test('provider blocked: the message shows where the iframe never loads, the button always stays', async ({
    page,
    context,
    browserName,
  }) => {
    await routeProvider(context, 'blocked')
    await openLevel(page)
    await app(page).getByRole('button', { name: 'Reproducir' }).click()
    const dialog = app(page).getByRole('dialog')
    await page.waitForTimeout(11_000)
    // Known limit of a cross-origin frame: Chromium fires its load event for its own
    // error page, so a blocked provider looks loaded there and no message is
    // shown. WebKit fires nothing, so the timeout speaks. Either way the way
    // out must be there.
    if (browserName === 'webkit')
      await expect(dialog.getByRole('status')).toHaveText('No pudimos cargar el video.')
    await expect(dialog.getByRole('button', { name: 'Empezar viaje' })).toBeVisible()
  })

  test('a provider that loads shows no failure message', async ({ page, context }) => {
    await routeProvider(context, 'small')
    await openLevel(page)
    await app(page).getByRole('button', { name: 'Reproducir' }).click()
    await page.waitForTimeout(11_000)
    await expect(app(page).getByRole('dialog').getByRole('status')).toHaveCount(0)
  })
})

test('?debug=layout reports no undersized video panel on a short viewport', async ({
  page,
  context,
}) => {
  await routeProvider(context, 'small')
  await openLevel(page, 'video', '&debug=layout')
  await app(page).getByRole('button', { name: 'Reproducir' }).click()
  await setFrameSize(page, 1100, 240)
  const frame = page.frames().find((f) => f !== page.mainFrame() && f.url().includes('/embed'))!
  const report = await frame.evaluate(() =>
    (
      window as unknown as { __layoutReport: () => Array<{ a: string; b: string }> }
    ).__layoutReport()
  )
  expect(report.filter((entry) => entry.a === 'video panel')).toEqual([])
})

test.describe('?diag=1', () => {
  test('shows the figures and makes no request at all', async ({ page, context }) => {
    await routeProvider(context, 'small')
    await openLevel(page, 'video', '&diag=1')
    await app(page).getByRole('button', { name: 'Reproducir' }).click()
    const panel = app(page).getByRole('region', { name: 'Diagnóstico' })
    await expect(panel).toBeVisible()
    await expect(
      panel.getByText('Panel del video').locator('xpath=following-sibling::dd[1]')
    ).toContainText('(proporción 1.78)')
    await expect(panel).toContainText('Navegador')
    await expect(panel).toContainText('Soporta aspect-ratio')

    // From here on the panel refreshes every second: it must not touch the network.
    const requests: string[] = []
    context.on('request', (request) => requests.push(request.url()))
    await page.waitForTimeout(3500)
    await setFrameSize(page, 900, 500)
    await page.waitForTimeout(1500)
    expect(requests).toEqual([])
  })

  test('is absent without the flag', async ({ page, context }) => {
    await routeProvider(context, 'small')
    await openLevel(page)
    await app(page).getByRole('button', { name: 'Reproducir' }).click()
    await expect(app(page).getByRole('region', { name: 'Diagnóstico' })).toHaveCount(0)
  })
})
