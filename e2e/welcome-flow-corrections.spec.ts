import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { app, routeProvider, setFrameSize } from './support.ts'
import { stubMedia } from './audioStub.ts'

// The corrections to the welcome flow: solid progress segments in every state and
// the card widths per step type. Layout only, like the other flow specs.

const flow = {
  enabled: true,
  title: null,
  message: null,
  video: null,
  playOnEnter: true,
  show: 'first_visit',
  steps: [
    {
      type: 'welcome',
      key: 'welcome001',
      title: 'Bienvenida',
      mandatory: true,
      revision: 1,
      message: 'Hola',
      buttonLabel: null,
    },
    {
      type: 'html',
      key: 'html00001',
      title: 'Reglas',
      mandatory: true,
      revision: 1,
      html: '<p>Reglas</p>',
      css: null,
      ack: { label: 'Acepto' },
      minSeconds: 0,
    },
    {
      type: 'video',
      key: 'video00001',
      title: 'Video',
      mandatory: false,
      revision: 1,
      video: { provider: 'youtube', videoId: 'jNQXAC9IVRw' },
      allowFallback: true,
    },
  ],
}

const open = async (page: Page, context: BrowserContext, size: readonly [number, number]) => {
  await stubMedia(context)
  await routeProvider(context, 'small')
  await page.goto('/mock-host/index.html')
  const input = page.locator('label:has-text("app URL") input')
  const current = await input.inputValue()
  await input.fill(
    `${current.split('?')[0]}?mockStableIds=1&mockWelcomeJson=${encodeURIComponent(JSON.stringify(flow))}`
  )
  await page.getByRole('button', { name: '(Re)load app' }).click()
  const level = app(page).getByRole('button', { name: /^1/ }).first()
  await level
    .waitFor({ timeout: 5000 })
    .then(() => level.click())
    .catch(() => undefined)
  await app(page).getByRole('dialog').waitFor()
  await setFrameSize(page, size[0], size[1])
}

const dialog = (page: Page) => app(page).getByRole('dialog', { name: 'Bienvenida', exact: true })

test('every progress segment is a solid shape in every state', async ({ page, context }) => {
  await open(page, context, [1280, 720])
  // Step 1 current, steps 2 and 3 locked.
  const read = () =>
    dialog(page)
      .locator('.flow-seg > span')
      .evaluateAll((spans) =>
        spans.map((span) => {
          const style = getComputedStyle(span)
          return {
            kind: (span.parentElement as HTMLElement).dataset.kind,
            borderStyle: [
              style.borderTopStyle,
              style.borderRightStyle,
              style.borderBottomStyle,
              style.borderLeftStyle,
            ],
            background: style.backgroundColor,
            opacity: style.opacity,
            animation: style.animationName,
          }
        })
      )
  const locked = await read()
  expect(locked.map((s) => s.kind)).toEqual(['current', 'locked', 'locked'])

  await dialog(page)
    .getByRole('button', { name: /Empezar viaje|Continuar/ })
    .first()
    .click()
  const visited = await read()
  expect(visited.map((s) => s.kind)).toEqual(['done', 'current', 'locked'])

  for (const seg of [...locked, ...visited]) {
    expect(seg.borderStyle, seg.kind).toEqual(['solid', 'solid', 'solid', 'solid'])
    expect(seg.background, `${seg.kind} is not a transparent void`).not.toBe('rgba(0, 0, 0, 0)')
    expect(seg.opacity, `${seg.kind} is not faded into a ghost`).toBe('1')
    expect(seg.animation, `${seg.kind} does not animate`).toBe('none')
  }
  // The states differ by more than color: the current one is taller.
  const heights = await dialog(page)
    .locator('.flow-seg > span')
    .evaluateAll((spans) => spans.map((s) => Math.round(s.getBoundingClientRect().height)))
  expect(heights[1]).toBeGreaterThan(heights[2])
})

// The card is 840 px for text and HTML steps and 960 for the video, never wider
// than 92 % of the window; at 768 and 360 the window is the limit, as before.
const WIDTHS: Array<[number, number, number, number]> = [
  // [window w, window h, text card, video card]
  [1280, 800, 840, 960],
  [1366, 768, 840, 960],
  [1920, 1080, 840, 960],
  [768, 1024, 707, 707],
  [360, 640, 331, 331],
]
for (const [w, h, text, video] of WIDTHS) {
  test(`card width at ${w}x${h}: ${text} px for text, ${video} px for video`, async ({
    page,
    context,
  }) => {
    await open(page, context, [w, h])
    const card = () => dialog(page).locator('.flow-card')
    const width = async () => Math.round((await card().boundingBox())!.width)
    expect(Math.abs((await width()) - text)).toBeLessThanOrEqual(1)
    // Visible margins around it: a card, not a full-bleed page.
    if (w >= 1280) expect(w - (await width())).toBeGreaterThanOrEqual(200)
    // Go to the HTML step (acks), then the video.
    await dialog(page)
      .getByRole('button', { name: /Empezar viaje|Continuar/ })
      .first()
      .click()
    expect(Math.abs((await width()) - text)).toBeLessThanOrEqual(1)
    await dialog(page).getByLabel('Acepto').check()
    await dialog(page).getByRole('button', { name: 'Continuar' }).click()
    await expect(dialog(page).getByRole('heading', { name: 'Video' })).toBeVisible()
    await page.waitForTimeout(400)
    expect(Math.abs((await width()) - video)).toBeLessThanOrEqual(1)
  })
}
