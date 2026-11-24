import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { app, setFrameSize } from './support.ts'
import { TrainerMock } from './trainerMock.ts'

// The exam's layout at the windows a course gives it: the pinned footer, no sideways
// scroll, no clipped card, and touch targets of 44 px, on the summary, a section with
// choices, the busiest one (a template with inline blanks and a word counter), the
// review and the result. Also at larger text.

const flow = {
  enabled: true,
  title: null,
  message: null,
  video: null,
  playOnEnter: true,
  show: 'first_visit',
  steps: [
    {
      type: 'assessment',
      key: 'check001',
      title: 'Evaluación de entrada',
      mandatory: true,
      revision: 1,
      purpose: 'check_in',
    },
    {
      type: 'welcome',
      key: 'welcome001',
      title: 'Listo',
      mandatory: true,
      revision: 1,
      message: 'Terminaste.',
      buttonLabel: null,
    },
  ],
}

const dialog = (page: Page) => app(page).getByRole('dialog', { name: 'Bienvenida', exact: true })

const open = async (
  page: Page,
  context: BrowserContext,
  size: readonly [number, number],
  zoom: number
) => {
  await new TrainerMock({}).install(context)
  await page.goto('/mock-host/index.html')
  const input = page.locator('label:has-text("app URL") input')
  const current = await input.inputValue()
  await input.fill(
    `${current.split('?')[0]}?mockStableIds=1&mockWelcomeJson=${encodeURIComponent(JSON.stringify(flow))}`
  )
  await page.getByRole('button', { name: '(Re)load app' }).click()
  await setFrameSize(page, size[0], size[1])
  const level = app(page).getByRole('button', { name: /^1/ }).first()
  await level.waitFor({ timeout: 8000 })
  await level.click()
  await dialog(page).waitFor()
  if (zoom !== 1)
    await app(page)
      .locator('body')
      .evaluate((_, value) => {
        document.documentElement.style.fontSize = `${value * 100}%`
      }, zoom)
}

const measure = (page: Page) =>
  app(page)
    .locator('body')
    .evaluate(() => {
      // The step entrance slides 16 px sideways: measure the resting layout.
      for (const animation of document.getAnimations())
        if ((animation as CSSAnimation).animationName === 'flow-step-in') animation.finish()
      const card = document.querySelector<HTMLElement>('.flow-card')!
      const scroller = card.querySelector<HTMLElement>('.flow-card-scroll')!
      const foot = card.querySelector<HTMLElement>('footer')!
      const c = card.getBoundingClientRect()
      const f = foot.getBoundingClientRect()
      const small = [...card.querySelectorAll<HTMLElement>('button, .exam-choice, .exam-pick')]
        .filter((el) => {
          const r = el.getBoundingClientRect()
          return r.width > 0 && r.height > 0 && r.height < 43.5 && !el.closest('.flow-seg')
        })
        .map(
          (el) =>
            `${(el.textContent ?? '').trim().slice(0, 24)}:${Math.round(el.getBoundingClientRect().height)}`
        )
      return {
        sideways: {
          document: document.documentElement.scrollWidth - innerWidth,
          scroller: scroller.scrollWidth - scroller.clientWidth,
          card: card.scrollWidth - card.clientWidth,
        },
        cardOver: c.height - innerHeight,
        cardLeft: c.left,
        cardRight: innerWidth - c.right,
        // The footer is pinned: inside the card, at its bottom, inside the window.
        footBottomGap: Math.abs(c.bottom - f.bottom),
        footVisible: f.top >= 0 && f.bottom <= innerHeight + 1,
        scrolls: scroller.scrollHeight > scroller.clientHeight,
        small,
        wide: [...card.querySelectorAll<HTMLElement>('*')]
          .filter((el) => el.getBoundingClientRect().right > c.right + 1)
          .slice(0, 4)
          .map((el) => `${el.tagName}.${String(el.className).slice(0, 40)}`),
        vw: innerWidth,
      }
    })

const SIZES: ReadonlyArray<readonly [number, number, number]> = [
  [360, 740, 1],
  [1366, 768, 1],
  [1280, 640, 1],
  [360, 740, 1.5],
  [1280, 640, 2],
]

const expectFits = async (page: Page, where: string) => {
  await page.waitForTimeout(250)
  const m = await measure(page)
  expect(JSON.stringify(m.sideways) + JSON.stringify(m.wide), `${where}: sideways scroll`).toBe(
    JSON.stringify({ document: 0, scroller: 0, card: 0 }) + '[]'
  )
  expect(m.cardOver, `${where}: card taller than the window`).toBeLessThanOrEqual(1)
  expect(m.cardLeft, `${where}: card clipped left`).toBeGreaterThanOrEqual(0)
  expect(m.cardRight, `${where}: card clipped right`).toBeGreaterThanOrEqual(0)
  expect(m.footVisible, `${where}: footer out of the window`).toBe(true)
  expect(m.footBottomGap, `${where}: footer not at the card's bottom`).toBeLessThanOrEqual(1)
  expect(m.small, `${where}: touch targets under 44 px`).toEqual([])
}

for (const [width, height, zoom] of SIZES) {
  test(`${width}x${height} at ${Math.round(zoom * 100)}% text: the exam fits, the footer stays pinned`, async ({
    page,
    context,
  }) => {
    await open(page, context, [width, height], zoom)
    await expectFits(page, 'step')
    await dialog(page).getByRole('button', { name: 'Empezar la evaluación' }).click()
    // The runner is a lazy chunk: wait for it before measuring.
    await dialog(page).getByRole('button', { name: 'Empezar', exact: true }).waitFor()
    await expectFits(page, 'summary')
    await dialog(page).getByRole('button', { name: 'Empezar', exact: true }).click()
    await expect(
      dialog(page)
        .getByText(/Sección 1 de 5/)
        .first()
    ).toBeVisible()
    await expectFits(page, 'listening')
    // The busiest one: a template with inline blanks and the word counter.
    for (let i = 0; i < 3; i++)
      await dialog(page).getByRole('button', { name: 'Siguiente sección' }).click()
    await expect(
      dialog(page)
        .getByText(/Sección 4 de 5/)
        .first()
    ).toBeVisible()
    await dialog(page).getByLabel('Espacio 1').fill('Maria')
    await expectFits(page, 'writing')
    // The primary action is reachable even when the body scrolls.
    await dialog(page).getByRole('button', { name: 'Siguiente sección' }).click()
    await dialog(page).getByRole('button', { name: 'Revisar y entregar' }).first().click()
    await expectFits(page, 'review')
    await dialog(page).getByRole('button', { name: 'Entregar', exact: true }).click()
    await dialog(page).getByRole('button', { name: 'Sí, entregar' }).click()
    await expect(dialog(page).getByRole('heading', { name: 'Tu punto de partida' })).toBeVisible()
    await expectFits(page, 'result')
  })
}

// Answering saves the attempt, and a save is not a new screen: the scroll stays where the
// student is. It used to jump to the top after every answer, because each save moved focus
// back to the section's title.
test('answering a question keeps the scroll where it is', async ({ page, context }) => {
  await open(page, context, [360, 560], 1)
  await dialog(page).getByRole('button', { name: 'Empezar la evaluación' }).click()
  await dialog(page).getByRole('button', { name: 'Empezar', exact: true }).waitFor()
  await dialog(page).getByRole('button', { name: 'Empezar', exact: true }).click()
  await expect(
    dialog(page)
      .getByText(/Sección 1 de 5/)
      .first()
  ).toBeVisible()
  const scroller = dialog(page).locator('.flow-card-scroll')
  await scroller.evaluate((node) => node.scrollTo(0, node.scrollHeight))
  const before = await scroller.evaluate((node) => node.scrollTop)
  expect(before, 'the section has to scroll for this to prove anything').toBeGreaterThan(50)
  await dialog(page).getByRole('radio', { name: 'Option B' }).last().check()
  // The save went out and came back: running, then saving, then running again.
  await expect(dialog(page).getByText('Guardado').first()).toBeVisible()
  expect(await scroller.evaluate((node) => node.scrollTop)).toBe(before)
})
