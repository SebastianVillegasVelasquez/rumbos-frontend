import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { app, routeProvider, setFrameSize } from './support.ts'
import { stubMedia } from './audioStub.ts'

// The video of a welcome step on a short viewport. It is sized by width first (the
// card's content width, 16:9) and the card scrolls inside itself, so a short window
// costs scrolling, never the size of the video. Measured at the windows of a
// laptop, inline in a frame of that size and in the host's fullscreen.

const flow = (mandatory: boolean) => ({
  enabled: true,
  title: null,
  message: null,
  video: null,
  playOnEnter: true,
  show: 'first_visit',
  steps: [
    {
      type: 'video',
      key: 'video00001',
      title: 'Video de bienvenida',
      mandatory,
      revision: 1,
      video: { provider: 'youtube', videoId: 'jNQXAC9IVRw' },
      allowFallback: true,
    },
    {
      type: 'welcome',
      key: 'welcome001',
      title: 'Fin',
      mandatory,
      revision: 1,
      message: 'Listo.',
      buttonLabel: null,
    },
  ],
})

const WINDOWS: ReadonlyArray<readonly [number, number]> = [
  [1280, 640],
  [1366, 700],
  [1440, 780],
  [1536, 735],
]
const MIN_VIDEO_WIDTH = 560

const dialog = (page: Page) => app(page).getByRole('dialog', { name: 'Bienvenida', exact: true })

const open = async (page: Page, context: BrowserContext, mandatory: boolean) => {
  await stubMedia(context)
  await routeProvider(context, 'small')
  await page.goto('/mock-host/index.html')
  const input = page.locator('label:has-text("app URL") input')
  const current = await input.inputValue()
  await input.fill(
    `${current.split('?')[0]}?mockStableIds=1&mockWelcomeJson=${encodeURIComponent(JSON.stringify(flow(mandatory)))}`
  )
  await page.getByRole('button', { name: '(Re)load app' }).click()
}

const enter = async (page: Page) => {
  const level = app(page).getByRole('button', { name: /^1/ }).first()
  await level
    .waitFor({ timeout: 5000 })
    .then(() => level.click())
    .catch(() => undefined)
  await dialog(page).waitFor()
}

// The poster is the size the player will have; the player takes its place.
const measure = async (page: Page) => {
  await dialog(page).locator('.flow-poster').waitFor()
  return app(page)
    .locator('body')
    .evaluate(() => {
      for (const animation of document.getAnimations())
        if ((animation as CSSAnimation).animationName === 'flow-step-in') animation.finish()
      const box = document.querySelector<HTMLElement>('.flow-poster')!.getBoundingClientRect()
      const card = document.querySelector<HTMLElement>('.flow-card')!.getBoundingClientRect()
      const scroller = document.querySelector<HTMLElement>('.flow-card-scroll')!
      const foot = document.querySelector<HTMLElement>('.flow-card footer')!.getBoundingClientRect()
      return {
        videoW: Math.round(box.width),
        videoH: Math.round(box.height),
        cardW: Math.round(card.width),
        cardH: Math.round(card.height),
        vw: innerWidth,
        vh: innerHeight,
        // Whether the card scrolls inside itself, and whether its footer is in view.
        scrolls: scroller.scrollHeight > scroller.clientHeight,
        footVisible: foot.bottom <= innerHeight + 1 && foot.top >= 0,
        pageScrollsSideways: document.documentElement.scrollWidth > innerWidth,
      }
    })
}

for (const [w, h] of WINDOWS) {
  test.describe(`${w}x${h}`, () => {
    test('inline (the frame is the window): the video is at least 560 px wide', async ({
      page,
      context,
    }, info) => {
      // Not mandatory, so the flow stays inline (as in the editor preview or after completion).
      await open(page, context, false)
      await setFrameSize(page, w, h)
      await enter(page)
      const size = await measure(page)
      info.annotations.push({
        type: 'size',
        description: JSON.stringify({ mode: 'inline', ...size }),
      })
      console.log(`SIZE ${info.project.name} inline ${w}x${h} ${JSON.stringify(size)}`)
      expect(size.videoW).toBeGreaterThanOrEqual(MIN_VIDEO_WIDTH)
      expect(Math.abs(size.videoW / size.videoH - 16 / 9)).toBeLessThan(0.03)
      expect(size.footVisible).toBe(true)
      expect(size.pageScrollsSideways).toBe(false)
    })

    test('fullscreen (the host stage): the video is at least 560 px wide', async ({
      page,
      context,
    }, info) => {
      await page.setViewportSize({ width: w, height: h })
      // Mandatory and unfinished: the flow asks the host for its own stage.
      await open(page, context, true)
      await enter(page)
      await expect(page.locator('#frame-wrap')).toHaveClass(/fullscreen/)
      // The real host's fullscreen fills the window; the mock keeps the inline size it
      // was given, so let it fill.
      await page.evaluate(() => {
        const wrap = document.querySelector<HTMLElement>('#frame-wrap')!
        for (const property of ['width', 'height', 'minHeight', 'maxWidth'] as const)
          wrap.style[property] = ''
      })
      await page.waitForTimeout(200)
      const size = await measure(page)
      info.annotations.push({
        type: 'size',
        description: JSON.stringify({ mode: 'fullscreen', ...size }),
      })
      console.log(`SIZE ${info.project.name} fullscreen ${w}x${h} ${JSON.stringify(size)}`)
      expect(size.videoW).toBeGreaterThanOrEqual(MIN_VIDEO_WIDTH)
      expect(Math.abs(size.videoW / size.videoH - 16 / 9)).toBeLessThan(0.03)
      expect(size.footVisible).toBe(true)
      expect(size.pageScrollsSideways).toBe(false)
    })
  })
}
