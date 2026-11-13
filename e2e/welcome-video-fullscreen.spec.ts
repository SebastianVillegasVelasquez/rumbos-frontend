import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { app } from './support.ts'
import { embedFrame } from './audioStub.ts'

// The video iframe must be allowed to go fullscreen from the player's own button.
// WHAT IS STUBBED: player.vimeo.com is answered by a local page (served at that
// origin, so the app's origin checks and the cross-origin iframe are real) with one
// button that calls document.documentElement.requestFullscreen() on click and
// reports the result to the embedder with postMessage. The app, the video
// iframe's attributes, the host iframe (allow="fullscreen") and the browser's
// Permissions Policy are real. Not covered: the real Vimeo player, Safari, iOS
// and Moodle (see docs/WELCOME-FLOW.md, "Hand tests").

const flow = {
  enabled: true,
  title: null,
  message: null,
  video: null,
  playOnEnter: true,
  show: 'first_visit',
  steps: [
    {
      type: 'video',
      key: 'video0001',
      title: 'Video',
      mandatory: false,
      revision: 1,
      video: { provider: 'vimeo', videoId: '1236382396' },
      allowFallback: true,
    },
  ],
}

const PLAYER = `<!doctype html><body style="margin:0;background:#222">
<button id="fs" style="width:100%;height:100%;font-size:24px">fullscreen</button>
<script>
const out = (o) => parent.postMessage({ fsProbe: true, ...o }, '*')
document.addEventListener('fullscreenchange', () => out({ ev: 'change', on: document.fullscreenElement !== null }))
document.getElementById('fs').onclick = () => {
  document.documentElement.requestFullscreen().then(
    () => out({ ev: 'result', ok: true }),
    (e) => out({ ev: 'result', ok: false, err: String(e) })
  )
}
</script>`

const stubPlayer = (context: BrowserContext) =>
  context.route('https://player.vimeo.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: PLAYER })
  )

const collectMessages = (context: BrowserContext) =>
  context.addInitScript(() => {
    const list: unknown[] = []
    ;(window as unknown as { __fs: unknown[] }).__fs = list
    window.addEventListener('message', (event) => {
      if (event.data && event.data.fsProbe) list.push(event.data)
    })
  })

const dialog = (page: Page) => app(page).getByRole('dialog', { name: 'Bienvenida', exact: true })

const openStudent = async (page: Page) => {
  await page.goto('/mock-host/index.html')
  const input = page.locator('label:has-text("app URL") input')
  const current = await input.inputValue()
  await input.fill(
    `${current.split('?')[0]}?mockStableIds=1&mockWelcomeJson=${encodeURIComponent(JSON.stringify(flow))}`
  )
  await page.getByRole('button', { name: '(Re)load app' }).click()
  const level = app(page).getByRole('button', { name: /^1/ }).first()
  await level.waitFor()
  await level.click()
  await dialog(page).waitFor()
}

const openPreview = async (page: Page) => {
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
  await dialog(page).waitFor()
}

for (const mode of ['student', 'preview'] as const) {
  // The preview has no "Pantalla completa" of its own, so it has one combination.
  for (const ownFullscreen of mode === 'preview' ? [false] : [false, true]) {
    test(`${mode}, flow ${ownFullscreen ? 'in its own fullscreen' : 'inline'}: the video iframe may go fullscreen`, async ({
      page,
      context,
    }) => {
      await stubPlayer(context)
      await collectMessages(context)
      await (mode === 'student' ? openStudent(page) : openPreview(page))
      if (ownFullscreen) {
        await dialog(page).getByRole('button', { name: 'Pantalla completa' }).click()
        await page.waitForTimeout(400)
      }
      await dialog(page)
        .getByRole('button', { name: /Reproducir/ })
        .click()
      const frame = dialog(page).locator('iframe')
      await frame.waitFor()

      // The attributes the browser enforces.
      const allow = (await frame.getAttribute('allow')) ?? ''
      expect(allow.split(';').map((token) => token.trim())).toContain('fullscreen')
      await expect(frame).toHaveAttribute('allowfullscreen', '')

      // A fullscreen request from inside the frame is not blocked by policy.
      await frame.contentFrame().locator('#fs').click()
      await expect
        .poll(() =>
          embedFrame(page).evaluate(
            () => (window as unknown as { __fs: Array<{ ev: string; ok?: boolean }> }).__fs
          )
        )
        .toContainEqual({ fsProbe: true, ev: 'result', ok: true })
      // The embedder's document sees the iframe as the fullscreen element.
      expect(await page.evaluate(() => document.fullscreenElement?.tagName)).toBe('IFRAME')
    })
  }
}
