import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { app, routeProvider } from './support.ts'
import { embedFrame, giveMapsMusic } from './audioStub.ts'
import { makeWav, spyOnAudioElements, serveAudioFixture, type FixtureKind } from './audioFixture.ts'

// The flow's music switch against the REAL audio session and a REAL <audio>
// element playing a real file (a WAV and an MP3 made at test time, served over
// http with their own Content-Type), triggered by real clicks. Nothing about the
// media is stubbed: assertions read the element's own `paused`, `muted` and
// `currentTime`. The older curtain-music spec stubs the element and covers the
// legacy curtain's switch; this one is the guard that was missing for the flow.

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
      mandatory: false,
      revision: 1,
      html: '<p>Reglas</p>',
      css: null,
      ack: null,
      minSeconds: 0,
    },
  ],
}

const open = async (page: Page, context: BrowserContext, kind: FixtureKind) => {
  await spyOnAudioElements(context)
  await serveAudioFixture(context, kind)
  await routeProvider(context, 'small')
  await page.goto('/mock-host/index.html')
  const input = page.locator('label:has-text("app URL") input')
  const current = await input.inputValue()
  await input.fill(
    `${current.split('?')[0]}?mockStableIds=1&mockWelcomeJson=${encodeURIComponent(JSON.stringify(flow))}`
  )
  await page.getByRole('button', { name: '(Re)load app' }).click()
  const level = app(page).getByRole('button', { name: /^1/ }).first()
  await level.waitFor()
  await giveMapsMusic(page)
  await level.click()
  await app(page).getByRole('dialog').waitFor()
}

const musicSwitch = (page: Page) => app(page).getByRole('switch', { name: 'Música de ambiente' })
const dialog = (page: Page) => app(page).getByRole('dialog', { name: 'Bienvenida', exact: true })
const primary = (page: Page) => dialog(page).getByRole('button', { name: 'Empezar viaje' })

interface Real {
  created: boolean
  paused: boolean | null
  muted: boolean | null
  time: number | null
  advancing: boolean
  error: string | null
  prefsMuted: boolean
  wants: boolean | null
  sessionPlaying: boolean
}

// The real element and the real session, read from inside the app.
const real = (page: Page, window = 600): Promise<Real> =>
  embedFrame(page).evaluate(async (ms) => {
    const url = '/src/features/audio/audioSession.ts'
    const { audioSession } = (await import(
      /* @vite-ignore */ url
    )) as typeof import('../src/features/audio/audioSession.ts')
    const view = audioSession.getView()
    const el = (window as unknown as { __audios: HTMLAudioElement[] }).__audios[0]
    const t0 = el?.currentTime ?? 0
    await new Promise((resolve) => setTimeout(resolve, ms))
    return {
      created: el !== undefined,
      paused: el ? el.paused : null,
      muted: el ? el.muted : null,
      time: el ? el.currentTime : null,
      advancing: el ? el.currentTime > t0 : false,
      error: el?.error ? `code ${el.error.code}` : null,
      prefsMuted: view.prefs.muted,
      wants: view.state.wants,
      sessionPlaying: view.playing,
    }
  }, window)

const expectSilent = async (page: Page) => {
  await expect
    .poll(async () => {
      const r = await real(page, 300)
      return !r.created || r.paused === true
    })
    .toBe(true)
}

// Can this engine, here, play any audio at all? Playwright's WebKit build on some
// machines fails every media load (MEDIA_ERR_SRC_NOT_SUPPORTED, even a data: WAV).
// Then the test falls back to what the session asked of the element (see the
// annotation on each run); where the engine plays, the full assertions run.
const engineCanPlay = (page: Page): Promise<boolean> =>
  embedFrame(page).evaluate(async (data) => {
    const probe = document.createElement('audio')
    probe.src = `data:audio/wav;base64,${data}`
    const played = await Promise.race([
      probe.play().then(
        () => true,
        () => false
      ),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2500)),
    ])
    const advanced =
      played &&
      (await new Promise<boolean>((resolve) =>
        setTimeout(() => resolve(probe.currentTime > 0), 600)
      ))
    probe.pause()
    return advanced
  }, makeWav(2).toString('base64'))

const relaxedIfNoPlayback = async (page: Page) => {
  const can = await engineCanPlay(page)
  if (!can)
    test.info().annotations.push({
      type: 'relaxed',
      description:
        'this engine cannot play any audio here: asserting the session wants playback and the element was created with the file, not currentTime',
    })
  return can
}

const expectAudible = async (page: Page, canPlay: boolean) => {
  if (!canPlay) {
    // The session wants sound, is not muted and asked the element for the file.
    await expect
      .poll(async () => {
        const r = await real(page, 200)
        return r.created && r.wants === true && !r.prefsMuted && r.muted === false
      })
      .toBe(true)
    return
  }
  await expect
    .poll(
      async () => {
        const r = await real(page, 500)
        return r.paused === false && r.muted === false && r.advancing
      },
      { timeout: 10_000, message: 'the real element is playing and its currentTime advances' }
    )
    .toBe(true)
}

for (const kind of ['wav', 'mp3'] as const) {
  test.describe(`welcome music switch, real ${kind} audio`, () => {
    test('on, then the primary button: the real element plays', async ({ page, context }) => {
      await open(page, context, kind)
      const canPlay = await relaxedIfNoPlayback(page)
      await expect(musicSwitch(page)).toHaveAttribute('aria-checked', 'true')
      // Nothing plays before the viewer's button.
      expect((await real(page, 300)).created).toBe(false)
      await primary(page).click()
      await expectAudible(page, canPlay)
    })

    test('off, then the primary button: nothing starts and the mute is remembered', async ({
      page,
      context,
    }) => {
      await open(page, context, kind)
      await musicSwitch(page).click()
      await expect(musicSwitch(page)).toHaveAttribute('aria-checked', 'false')
      expect((await real(page, 100)).prefsMuted).toBe(true)
      await primary(page).click()
      await page.waitForTimeout(800)
      await expectSilent(page)
      expect((await real(page, 100)).prefsMuted).toBe(true)
    })

    test('toggled while it plays, also after Atrás: off stops it, on resumes it', async ({
      page,
      context,
    }) => {
      await open(page, context, kind)
      const canPlay = await relaxedIfNoPlayback(page)
      await primary(page).click()
      await expectAudible(page, canPlay)
      await dialog(page).getByRole('button', { name: 'Atrás' }).click()
      await expect(musicSwitch(page)).toHaveAttribute('aria-checked', 'true')

      await musicSwitch(page).click()
      await expect(musicSwitch(page)).toHaveAttribute('aria-checked', 'false')
      await expectSilent(page)
      expect((await real(page, 100)).prefsMuted).toBe(true)

      await musicSwitch(page).click()
      await expect(musicSwitch(page)).toHaveAttribute('aria-checked', 'true')
      await expectAudible(page, canPlay)
      expect((await real(page, 100)).prefsMuted).toBe(false)
    })
  })
}

// The editor's "Probar el flujo": nothing plays and nothing is stored, but the
// switch must answer. (It used to be dimmed and dead.)
test('the preview switch answers from memory and never touches the saved mute', async ({
  page,
  context,
}) => {
  await spyOnAudioElements(context)
  await page.goto('/mock-host/index.html')
  await page.locator('label:has-text("role") select').selectOption('editor')
  await page.locator('label:has-text("editing on") input').check()
  const input = page.locator('label:has-text("app URL") input')
  const current = await input.inputValue()
  await input.fill(
    `${current.split('?')[0]}?mockWelcomeJson=${encodeURIComponent(JSON.stringify(flow))}`
  )
  await page.getByRole('button', { name: '(Re)load app' }).click()
  const level = app(page).getByRole('button', { name: /^1/ }).first()
  await level.waitFor()
  await giveMapsMusic(page)
  await level.click()
  await app(page)
    .getByRole('button', { name: /^Apariencia/ })
    .first()
    .click()
  await app(page)
    .getByRole('button', { name: /Flujo de bienvenida|Bienvenida/ })
    .first()
    .click()
  await app(page).getByRole('button', { name: 'Probar el flujo' }).click()
  await expect(dialog(page).getByText('Vista previa: no se guarda nada.')).toBeVisible()

  const toggle = musicSwitch(page)
  await expect(toggle).toBeEnabled()
  const start = (await toggle.getAttribute('aria-checked')) === 'true'
  const word = (on: boolean) => (on ? 'Activada' : 'Desactivada')
  await expect(toggle).toContainText(word(start))
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', String(!start))
  await expect(toggle).toContainText(word(!start))
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', String(start))
  // Keyboard: focus and Space.
  await toggle.focus()
  await page.keyboard.press('Space')
  await expect(toggle).toHaveAttribute('aria-checked', String(!start))

  // Nothing was stored and no audio element was ever made.
  const after = await embedFrame(page).evaluate(() => ({
    stored: window.localStorage.getItem('rumbos.audio.prefs'),
    elements: (window as unknown as { __audios: unknown[] }).__audios.length,
  }))
  expect(after.stored).toBeNull()
  expect(after.elements).toBe(0)
})
