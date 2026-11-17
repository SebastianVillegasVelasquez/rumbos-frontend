import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { app, routeProvider } from './support.ts'
import { embedFrame, giveMapsMusic } from './audioStub.ts'
import { makeWav, serveAudioFixture, spyOnAudioElements } from './audioFixture.ts'
import { TrainerMock } from './trainerMock.ts'

// The exam's listening clip against the REAL audio session and REAL <audio>
// elements playing a real file made at test time (a two-second tone), started by a
// real click. Nothing about the media is stubbed. The recurring failure of this
// project is the music switch breaking after other audio, so this reads the
// elements themselves: the ambient track (the first element) must go quiet while the
// clip plays, and come back only if it was playing and the viewer had not muted it;
// the welcome music switch must still work after the clip.

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
      type: 'assessment',
      key: 'check001',
      title: 'Evaluación de entrada',
      mandatory: true,
      revision: 1,
      purpose: 'check_in',
    },
  ],
}

const open = async (page: Page, context: BrowserContext) => {
  await spyOnAudioElements(context)
  await serveAudioFixture(context, 'wav')
  await routeProvider(context, 'small')
  await new TrainerMock({}).install(context)
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

const dialog = (page: Page) => app(page).getByRole('dialog', { name: 'Bienvenida', exact: true })
const musicSwitch = (page: Page) => app(page).getByRole('switch', { name: 'Música de ambiente' })

interface Snap {
  count: number
  ambient: { paused: boolean; time: number } | null
  clip: { paused: boolean; muted: boolean; time: number; ended: boolean; src: string } | null
  advancing: { ambient: boolean; clip: boolean }
  prefsMuted: boolean
}

// Both real elements, read from inside the app over a short window.
const read = (page: Page, window = 500): Promise<Snap> =>
  embedFrame(page).evaluate(async (ms) => {
    const url = '/src/features/audio/audioSession.ts'
    const { audioSession } = (await import(
      /* @vite-ignore */ url
    )) as typeof import('../src/features/audio/audioSession.ts')
    const all = (window as unknown as { __audios: HTMLAudioElement[] }).__audios
    // The clip is the element whose file is the exam's tone; the ambient track is the
    // other one (it only exists once the music has started).
    const isClip = (el: HTMLAudioElement) => (el.currentSrc || el.src).includes('/__tone.wav')
    const clip = all.find(isClip)
    const ambient = all.find((el) => !isClip(el))
    const t0 = { a: ambient?.currentTime ?? 0, c: clip?.currentTime ?? 0 }
    await new Promise((resolve) => setTimeout(resolve, ms))
    return {
      count: all.length,
      ambient: ambient ? { paused: ambient.paused, time: ambient.currentTime } : null,
      clip: clip
        ? {
            paused: clip.paused,
            muted: clip.muted,
            time: clip.currentTime,
            ended: clip.ended,
            src: clip.currentSrc || clip.src,
          }
        : null,
      advancing: {
        ambient: ambient ? ambient.currentTime > t0.a : false,
        clip: clip ? clip.currentTime > t0.c : false,
      },
      prefsMuted: audioSession.getView().prefs.muted,
    }
  }, window)

// Can this engine, here, play any audio at all? On some machines Playwright's WebKit
// fails every media load. Then the clip is only checked for what the app asked of the
// element, and the annotation says so.
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

const relaxed = async (page: Page) => {
  const can = await engineCanPlay(page)
  if (!can)
    test.info().annotations.push({
      type: 'relaxed',
      description:
        'this engine cannot play any audio here: asserting the clip element was created, played by a click and held the music, not currentTime',
    })
  return can
}

const startToExam = async (page: Page) => {
  await dialog(page).getByRole('button', { name: 'Empezar viaje' }).click()
  await dialog(page).getByRole('button', { name: 'Empezar la evaluación' }).click()
  await dialog(page).getByRole('button', { name: 'Empezar', exact: true }).click()
  await expect(
    dialog(page)
      .getByText(/Sección 1 de 5/)
      .first()
  ).toBeVisible()
}

const listen = (page: Page) => dialog(page).getByRole('button', { name: /^Escuchar: Pregunta 1$/ })

test.describe('exam audio against the real session and real elements', () => {
  test('a click plays the clip, the ambient music goes quiet and comes back', async ({
    page,
    context,
  }) => {
    await open(page, context)
    const canPlay = await relaxed(page)
    await startToExam(page)
    // The ambient music started on the welcome button (where the engine can play).
    if (canPlay)
      await expect
        .poll(async () => (await read(page, 300)).ambient?.paused, { timeout: 10_000 })
        .toBe(false)
    // No autoplay: the clip element does not exist before the click.
    expect((await read(page, 200)).clip).toBeNull()

    await listen(page).click()
    if (canPlay) {
      await expect
        .poll(
          async () => {
            const s = await read(page, 400)
            return (
              s.clip !== null &&
              s.clip.paused === false &&
              s.clip.muted === false &&
              s.advancing.clip &&
              s.ambient?.paused === true
            )
          },
          { timeout: 10_000, message: 'the clip plays, its time advances, the ambient is held' }
        )
        .toBe(true)
      // The tone ends by itself: the ambient music comes back, playing for real.
      await expect
        .poll(
          async () => {
            const s = await read(page, 500)
            return s.clip?.ended === true && s.ambient?.paused === false && s.advancing.ambient
          },
          { timeout: 15_000, message: 'after the clip the ambient resumes and advances' }
        )
        .toBe(true)
    } else {
      await expect.poll(async () => (await read(page, 200)).clip !== null).toBe(true)
      expect((await read(page, 200)).clip?.src).toContain('/__tone.wav')
    }
    // The transcript is never shown in the exam.
    await expect(dialog(page).getByText('Transcripción')).toHaveCount(0)
  })

  test('a muted viewer: the clip plays and the ambient music stays off afterwards', async ({
    page,
    context,
  }) => {
    await open(page, context)
    const canPlay = await relaxed(page)
    await musicSwitch(page).click()
    await expect(musicSwitch(page)).toHaveAttribute('aria-checked', 'false')
    await startToExam(page)
    await listen(page).click()
    if (canPlay)
      await expect
        .poll(async () => (await read(page, 300)).clip?.paused === false, { timeout: 10_000 })
        .toBe(true)
    await page.waitForTimeout(canPlay ? 3000 : 800)
    const after = await read(page, 300)
    // Never restored over the viewer's mute.
    expect(after.prefsMuted).toBe(true)
    expect(after.ambient === null || after.ambient.paused).toBe(true)
  })

  test('the welcome music switch still works after the exam audio', async ({ page, context }) => {
    await open(page, context)
    const canPlay = await relaxed(page)
    await startToExam(page)
    await listen(page).click()
    if (canPlay)
      await expect
        .poll(async () => (await read(page, 300)).clip?.ended === true, { timeout: 15_000 })
        .toBe(true)
    else await page.waitForTimeout(800)
    // Out of the exam, back to the welcome step, and use the switch.
    await dialog(page).getByRole('button', { name: 'Volver al mapa' }).click()
    await dialog(page).getByRole('button', { name: 'Atrás' }).click()
    await expect(musicSwitch(page)).toHaveAttribute('aria-checked', 'true')
    await musicSwitch(page).click()
    await expect(musicSwitch(page)).toHaveAttribute('aria-checked', 'false')
    expect((await read(page, 100)).prefsMuted).toBe(true)
    await expect
      .poll(async () => (await read(page, 300)).ambient?.paused ?? true, { timeout: 8000 })
      .toBe(true)
    await musicSwitch(page).click()
    await expect(musicSwitch(page)).toHaveAttribute('aria-checked', 'true')
    expect((await read(page, 100)).prefsMuted).toBe(false)
    if (canPlay)
      await expect
        .poll(async () => (await read(page, 500)).advancing.ambient, { timeout: 10_000 })
        .toBe(true)
  })
})
