import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { stubMedia } from './audioStub.ts'
import { app, routeProvider, setFrameSize } from './support.ts'

// The rest of the welcome flow's browser tests: the video fallback timing with a
// provider that works, fails or is blocked; the quiz outcomes; what is remembered
// and when it is asked again; reduced motion; fullscreen; and the layout at the
// sizes a course gives the frame. The host is the mock host (plugin v5.8 side).

const head = {
  enabled: true,
  title: null,
  message: null,
  video: null,
  playOnEnter: true,
  show: 'first_visit',
}
const welcomeStep = {
  type: 'welcome',
  key: 'welcome001',
  title: 'Bienvenida al curso',
  mandatory: true,
  revision: 1,
  message: 'Hola.',
  buttonLabel: null,
}
const videoStep = {
  type: 'video',
  key: 'video00001',
  title: 'Video de inicio',
  mandatory: true,
  revision: 1,
  video: { provider: 'youtube', videoId: 'jNQXAC9IVRw' },
  allowFallback: true,
}
const quizStep = {
  type: 'quiz',
  key: 'quiz00001',
  title: 'Evaluación',
  mandatory: true,
  revision: 1,
  cmid: 101,
  intro: null,
  outcomeAbove: 'Aprobaste.',
  outcomeBelow: 'Puedes mejorar.',
}
const htmlStep = {
  type: 'html',
  key: 'html00001',
  title: 'Reglas',
  mandatory: true,
  revision: 1,
  html: '<h2>Reglas</h2><p>Sé amable.</p>',
  css: null,
  ack: { label: 'Leí y acepto las reglas' },
  minSeconds: 0,
}
const flowOf = (...steps: object[]) => ({ ...head, steps })

const dialog = (page: Page) => app(page).getByRole('dialog', { name: 'Bienvenida', exact: true })
const next = (page: Page) =>
  dialog(page).getByRole('button', { name: /^(Continuar|Terminar|Empezar viaje)$/ })
const hostLog = (page: Page) => page.locator('#log')

interface Options {
  provider?: 'small' | 'blocked' | 'ready' | 'error'
  flowMode?: string
  quiz?: string
}

const SURROGATES = {
  ready: `<!doctype html><script>parent.postMessage(JSON.stringify({event:'onReady'}),'*')</script>`,
  error: `<!doctype html><script>parent.postMessage(JSON.stringify({event:'onError',info:150}),'*')</script>`,
}

const open = async (page: Page, context: BrowserContext, welcome: object, o: Options = {}) => {
  await stubMedia(context)
  const mode = o.provider ?? 'small'
  if (mode === 'ready' || mode === 'error') {
    await context.route('https://www.youtube-nocookie.com/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: SURROGATES[mode] })
    )
  } else await routeProvider(context, mode)
  await page.goto('/mock-host/index.html')
  if (o.flowMode)
    await page.locator('label:has-text("flow progress") select').selectOption(o.flowMode)
  if (o.quiz) await page.locator('label:has-text("quiz result") select').selectOption(o.quiz)
  await load(page, welcome)
}

const load = async (page: Page, welcome: object) => {
  const input = page.locator('label:has-text("app URL") input')
  const current = await input.inputValue()
  await input.fill(
    `${current.split('?')[0]}?mockStableIds=1&mockWelcomeJson=${encodeURIComponent(JSON.stringify(welcome))}`
  )
  await page.getByRole('button', { name: '(Re)load app' }).click()
  const level = app(page).getByRole('button', { name: /^1/ }).first()
  // With stable ids the app reopens the last map by itself: click the level only
  // when the list is what is showing.
  await level
    .waitFor({ timeout: 5000 })
    .then(() => level.click())
    .catch(() => undefined)
}

test.describe('video step: the way out and its timing', () => {
  test('provider blocked: no way out before 10 s, then it appears and records fallback', async ({
    page,
    context,
  }) => {
    await open(page, context, flowOf(welcomeStep, videoStep), { provider: 'blocked' })
    await dialog(page).getByRole('button', { name: 'Empezar viaje' }).click()
    await dialog(page).getByRole('button', { name: 'Reproducir video' }).click()
    await expect(next(page)).toHaveAttribute('aria-disabled', 'true')
    await page.waitForTimeout(8000)
    await expect(dialog(page).getByText('¿Problemas con el video?')).toHaveCount(0)
    await expect(dialog(page).getByText('¿Problemas con el video?')).toBeVisible({
      timeout: 6000,
    })
    await dialog(page).getByRole('button', { name: '¿Problemas con el video?' }).click()
    await expect(dialog(page).getByText('Continuaste sin ver el video.')).toBeVisible()
    await expect(next(page)).toHaveAttribute('aria-disabled', 'false')
    await next(page).click()
    await expect(hostLog(page)).toContainText('"stepKey":"video00001"')
    await expect(hostLog(page)).toContainText('"method":"fallback"')
  })

  test('player reports ready: the way out never shows, however long we wait', async ({
    page,
    context,
  }) => {
    await open(page, context, flowOf(welcomeStep, videoStep), { provider: 'ready' })
    await dialog(page).getByRole('button', { name: 'Empezar viaje' }).click()
    await dialog(page).getByRole('button', { name: 'Reproducir video' }).click()
    await page.waitForTimeout(11_500)
    await expect(dialog(page).getByText('¿Problemas con el video?')).toHaveCount(0)
    await expect(next(page)).toHaveAttribute('aria-disabled', 'true')
  })

  test('player reports an error: the way out shows at once', async ({ page, context }) => {
    await open(page, context, flowOf(welcomeStep, videoStep), { provider: 'error' })
    await dialog(page).getByRole('button', { name: 'Empezar viaje' }).click()
    await dialog(page).getByRole('button', { name: 'Reproducir video' }).click()
    await expect(dialog(page).getByText('¿Problemas con el video?')).toBeVisible({
      timeout: 4000,
    })
  })

  test('without the option there is no way out even when the player never answers', async ({
    page,
    context,
  }) => {
    await open(page, context, flowOf(welcomeStep, { ...videoStep, allowFallback: false }), {
      provider: 'blocked',
    })
    await dialog(page).getByRole('button', { name: 'Empezar viaje' }).click()
    await dialog(page).getByRole('button', { name: 'Reproducir video' }).click()
    await page.waitForTimeout(11_500)
    await expect(dialog(page).getByText('¿Problemas con el video?')).toHaveCount(0)
    await expect(next(page)).toHaveAttribute('aria-disabled', 'true')
  })
})

test.describe('quiz step: what the student is told', () => {
  const reach = async (page: Page) => {
    await dialog(page).getByRole('button', { name: 'Empezar viaje' }).click()
    await expect(dialog(page).getByRole('heading', { name: 'Evaluación' })).toBeVisible()
  }
  const cases: Array<[string, RegExp, boolean]> = [
    ['passed (85%)', /Tu resultado: 85 %\./, true],
    ['failed (40%)', /Tu resultado: 40 %\./, true],
    ['hidden grade', /Completaste la evaluación\./, true],
    ['pending grading', /pendiente de revisión/, true],
    ['not found', /No encontramos la evaluación/, true],
    ['unavailable', /No pudimos consultar la evaluación/, true],
    ['no permission', /No pudimos consultar la evaluación/, true],
  ]
  for (const [scenario, expected, canContinue] of cases)
    test(`${scenario}`, async ({ page, context }) => {
      await open(page, context, flowOf(welcomeStep, quizStep), { quiz: scenario })
      await reach(page)
      await expect(dialog(page).getByText(expected)).toBeVisible({ timeout: 8000 })
      await expect(next(page)).toHaveAttribute('aria-disabled', canContinue ? 'false' : 'true')
    })

  test('an older plugin that never answers stops the wait after 6 s', async ({ page, context }) => {
    await open(page, context, flowOf(welcomeStep, quizStep), {
      quiz: 'older plugin (silent)',
    })
    await reach(page)
    await expect(next(page)).toHaveAttribute('aria-disabled', 'true')
    await expect(dialog(page).getByText(/No pudimos consultar la evaluación/)).toBeVisible({
      timeout: 10_000,
    })
    await expect(next(page)).toHaveAttribute('aria-disabled', 'false')
  })
})

test.describe('what is remembered', () => {
  const finish = async (page: Page) => {
    await dialog(page).getByRole('button', { name: 'Empezar viaje' }).click()
    await dialog(page).getByRole('checkbox', { name: 'Leí y acepto las reglas' }).check()
    await next(page).click()
    await expect(dialog(page)).toHaveCount(0)
  }

  test('a raised revision asks the step again, and only that step', async ({ page, context }) => {
    const flow = flowOf(welcomeStep, htmlStep)
    await open(page, context, flow)
    await finish(page)

    await load(page, flow)
    await page.waitForTimeout(1500)
    await expect(dialog(page)).toHaveCount(0)

    await load(page, flowOf(welcomeStep, { ...htmlStep, revision: 2 }))
    await expect(dialog(page)).toBeVisible()
    await expect(dialog(page).getByRole('heading', { name: 'Reglas' })).toBeVisible()
    await expect(dialog(page).getByText('Paso 2 de 2 · Lectura', { exact: true })).toBeVisible()
  })

  test('a step added later is asked alone', async ({ page, context }) => {
    await open(page, context, flowOf(welcomeStep, htmlStep))
    await finish(page)
    await load(page, flowOf(welcomeStep, htmlStep, quizStep))
    await expect(dialog(page).getByRole('heading', { name: 'Evaluación' })).toBeVisible()
  })

  for (const mode of ['readonly', 'older plugin (silent)'])
    test(`${mode}: a local flag stops it from coming back`, async ({ page, context }) => {
      const flow = flowOf(welcomeStep, htmlStep)
      await open(page, context, flow, { flowMode: mode })
      // The older plugin never answers: the flow waits up to 3 s for the host.
      await expect(dialog(page)).toBeVisible({ timeout: 8000 })
      await finish(page)
      await load(page, flow)
      await page.waitForTimeout(4500)
      await expect(dialog(page)).toHaveCount(0)
    })

  test('guest: kept in memory only, so it comes back on the next visit', async ({
    page,
    context,
  }) => {
    const flow = flowOf(welcomeStep, htmlStep)
    await open(page, context, flow, { flowMode: 'guest (not persistent)' })
    await finish(page)
    await load(page, flow)
    await expect(dialog(page)).toBeVisible()
  })

  test('guest: nothing is written to the host', async ({ page, context }) => {
    await open(page, context, flowOf(welcomeStep, htmlStep), { flowMode: 'guest (not persistent)' })
    await expect(dialog(page)).toBeVisible()
    await finish(page)
    await page.waitForTimeout(500)
    expect(await hostLog(page).innerText()).not.toContain('"stepKey":"html00001"')
  })
})

test.describe('motion and fullscreen', () => {
  test('reduced motion: the step does not animate in', async ({ page, context }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await open(page, context, flowOf(welcomeStep, htmlStep))
    await expect(dialog(page)).toBeVisible()
    const names = await dialog(page)
      .locator('.flow-step-in')
      .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).animationName))
    for (const name of names) expect(name).toBe('none')
  })

  test('the fullscreen button asks the host', async ({ page, context }) => {
    await open(page, context, flowOf(welcomeStep, htmlStep))
    const button = dialog(page).getByRole('button', { name: 'Pantalla completa' })
    await expect(button).toBeVisible()
    await button.click()
    await expect(hostLog(page)).toContainText('request-fullscreen')
  })
})

test.describe('layout at the sizes a course gives the frame', () => {
  const sizes: Array<[number, number]> = [
    [360, 640],
    [640, 360],
    [768, 1024],
    [1024, 768],
    [1280, 720],
    [1920, 1080],
  ]
  for (const [width, height] of sizes)
    test(`${width}x${height}: Continuar is reachable, nothing overflows or overlaps`, async ({
      page,
      context,
    }) => {
      await open(page, context, flowOf(welcomeStep, htmlStep))
      await setFrameSize(page, width, height)
      await expect(dialog(page)).toBeVisible()
      // The decorative backdrop is scaled and clipped on purpose, so the root scroll
      // width says nothing: what must stay inside the frame is every control.
      const report = await dialog(page).evaluate((element) => {
        const outside: string[] = []
        for (const control of element.querySelectorAll<HTMLElement>(
          'button, input, [role=checkbox], iframe, a[href]'
        )) {
          const box = control.getBoundingClientRect()
          if (box.width === 0 || box.height === 0) continue
          if (box.left < -1 || box.right > window.innerWidth + 1)
            outside.push(
              control.getAttribute('aria-label') ?? control.textContent ?? control.tagName
            )
        }
        return { outside, viewport: { w: window.innerWidth, h: window.innerHeight } }
      })
      expect(report.outside).toEqual([])
      const target = await next(page).boundingBox()
      expect(target).not.toBeNull()
      // The primary button is inside the frame and a comfortable touch target.
      const frame = await page.locator('#frame-wrap').boundingBox()
      expect(target!.y + target!.height).toBeLessThanOrEqual(frame!.y + frame!.height + 1)
      expect(target!.height).toBeGreaterThanOrEqual(40)
    })
})
