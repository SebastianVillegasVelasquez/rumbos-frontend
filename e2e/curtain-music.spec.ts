import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { app, routeProvider } from './support.ts'
import { embedFrame, giveMapsMusic, snapshot, stubMedia } from './audioStub.ts'

// The welcome curtain's music control, against the real audio session and the
// real reducer. Only the media element is stubbed (see audioStub.ts): autoplay
// policies make real playback unreliable in CI, so `paused` is whatever the
// session last asked for with play() / pause().

const open = async (
  page: Page,
  context: BrowserContext,
  welcome: 'video' | 'message',
  { delayChunk = false } = {}
) => {
  if (delayChunk)
    await context.route('**/features/audio/audioSession.ts*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2500))
      await route.continue()
    })
  await stubMedia(context)
  await routeProvider(context, 'small')
  await page.goto('/mock-host/index.html')
  const input = page.locator('label:has-text("app URL") input')
  const current = await input.inputValue()
  await input.fill(`${current.split('?')[0]}?mockWelcome=${welcome}`)
  await page.getByRole('button', { name: '(Re)load app' }).click()
  const level = app(page).getByRole('button', { name: /^1/ }).first()
  await level.waitFor()
  await giveMapsMusic(page)
  await level.click()
  await app(page).getByRole('dialog').waitFor()
}

const musicSwitch = (page: Page) => app(page).getByRole('switch', { name: 'Música de fondo' })
const primary = (page: Page) =>
  app(page).getByRole('button', { name: /^(Empezar viaje|Reproducir)$/ })

// "Sounding" as the stubbed element sees it: play() was called and no pause() since.
const sounding = (page: Page) => snapshot(page).then((s) => s.elementPaused === false)
const expectSounding = (page: Page, value: boolean) =>
  expect.poll(() => sounding(page), { timeout: 8000 }).toBe(value)

test.describe('curtain music control', () => {
  test('a click on the switch does not start the music; off stays off at the button', async ({
    page,
    context,
  }) => {
    await open(page, context, 'message')
    await expect(musicSwitch(page)).toHaveAttribute('aria-checked', 'true')
    await musicSwitch(page).click()
    await expect(musicSwitch(page)).toHaveAttribute('aria-checked', 'false')
    const state = await snapshot(page)
    expect(state.muted).toBe(true)
    expect(state.storedMuted).toBe(true)
    expect(state.playing).toBe(false)
    expect(state.elementPaused, 'play() was never called').toBeUndefined()

    await primary(page).click()
    await expect(app(page).getByRole('dialog')).toHaveCount(0)
    await page.waitForTimeout(800)
    expect(await sounding(page)).toBe(false)
    expect((await snapshot(page)).wants).toBe(false)
  })

  test('switch on (the default) starts at the primary button, not before', async ({
    page,
    context,
  }) => {
    await open(page, context, 'message')
    await page.waitForTimeout(600)
    expect((await snapshot(page)).elementPaused, 'nothing before the button').toBeUndefined()
    await primary(page).click()
    await expectSounding(page, true)
  })

  test('the disc and the title are part of the one switch', async ({ page, context }) => {
    await open(page, context, 'message')
    // The disc and the title sit inside the switch: no second control, no dead disc.
    await expect(app(page).getByRole('dialog').getByRole('switch')).toHaveCount(1)
    await expect(musicSwitch(page)).toContainText(/Con música/)
    await musicSwitch(page).locator('span[aria-hidden]').first().click()
    await expect(musicSwitch(page)).toHaveAttribute('aria-checked', 'false')
    await expect(musicSwitch(page)).toContainText(/Sin música/)
  })

  test('keyboard: Space and Enter toggle it and the state is announced by aria-checked', async ({
    page,
    context,
  }) => {
    await open(page, context, 'message')
    await musicSwitch(page).focus()
    await page.keyboard.press('Space')
    await expect(musicSwitch(page)).toHaveAttribute('aria-checked', 'false')
    expect((await snapshot(page)).muted).toBe(true)
    await page.keyboard.press('Enter')
    await expect(musicSwitch(page)).toHaveAttribute('aria-checked', 'true')
    expect((await snapshot(page)).muted).toBe(false)
  })

  test('video: the music waits, comes back on skip, and the switch works while it plays', async ({
    page,
    context,
  }) => {
    await open(page, context, 'video')
    await app(page).getByRole('button', { name: 'Reproducir' }).click()
    // Held under the video: the session wants it, nothing is sounding.
    await expect.poll(async () => (await snapshot(page)).held).toBe(true)
    expect((await snapshot(page)).wants).toBe(true)
    // The element is paused once the short fade-out ends.
    await expectSounding(page, false)

    await app(page).getByRole('button', { name: 'Saltar' }).click()
    await expectSounding(page, true)

    // Music already playing: switch off stops it, on brings it back.
    await musicSwitch(page).click()
    await expectSounding(page, false)
    expect((await snapshot(page)).muted).toBe(true)
    await musicSwitch(page).click()
    await expectSounding(page, true)
    expect((await snapshot(page)).muted).toBe(false)

    // Off, then the button: it stays off.
    await musicSwitch(page).click()
    await expectSounding(page, false)
    await app(page)
      .getByRole('button', { name: /Empezar viaje/ })
      .click()
    await page.waitForTimeout(800)
    expect(await sounding(page)).toBe(false)
  })

  test('the HUD control shows the same state after the curtain', async ({ page, context }) => {
    await open(page, context, 'message')
    await musicSwitch(page).click()
    await primary(page).click()
    await expect(app(page).getByRole('dialog', { name: 'Bienvenida' })).toHaveCount(0)
    // The demo map opens an info bubble on the first visit; close it.
    await expect(app(page).getByRole('dialog', { name: 'Bienvenida al curso' })).toBeVisible()
    await app(page)
      .getByRole('dialog', { name: 'Bienvenida al curso' })
      .getByRole('button', { name: 'Cerrar' })
      .first()
      .click()
    // Then the first-visit guide; skip it too.
    await app(page).getByRole('button', { name: 'Omitir' }).click()
    await expect(app(page).getByRole('dialog')).toHaveCount(0)
    const hud = app(page).getByRole('button', { name: /^Música: / })
    await hud.click()
    await expect(app(page).getByRole('switch', { name: 'Activar la música' })).toHaveAttribute(
      'aria-checked',
      'false'
    )
    expect((await snapshot(page)).muted).toBe(true)
  })

  test('a click before the audio chunk arrives is not lost', async ({ page, context }) => {
    await open(page, context, 'message', { delayChunk: true })
    await musicSwitch(page).click()
    await expect(musicSwitch(page)).toHaveAttribute('aria-checked', 'false')
    await primary(page).click()
    // The chunk arrives about 2.5 s later and the viewer's choice is replayed.
    await expect
      .poll(
        () => embedFrame(page).evaluate(() => window.localStorage.getItem('rumbos.audio.prefs')),
        { timeout: 10_000 }
      )
      .toContain('"muted":true')
    // The next click anywhere must not start what they switched off.
    await embedFrame(page).evaluate(() => document.body.click())
    await page.waitForTimeout(800)
    expect(await sounding(page)).toBe(false)
  })
})
