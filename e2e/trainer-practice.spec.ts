import { expect, test, type Page } from '@playwright/test'
import { app } from './support.ts'
import { hud, open, stage } from './trainerHarness.ts'

// The practice trainer against a mock server that implements contract v2: the HUD
// button, the stage and its Esc and focus, S1 to S3, a run through every step type,
// a failed answer that keeps what was typed and retries with the same attempt_id,
// a written answer's comparison, the guided dialogue, the vocabulary review, the
// preview banner, the final-exam card, and the layout at three windows.

const openStage = async (page: Page) => {
  await hud(page).click()
  // The first open compiles the lazy chunk on a cold dev server.
  await expect(stage(page)).toBeVisible({ timeout: 20_000 })
  // First use: accept once; later opens go straight to the home.
  const accept = stage(page).getByRole('button', { name: 'Entendido, empezar' })
  const lessons = stage(page).getByRole('button', { name: 'Elige una lección' })
  await expect(accept.or(lessons).first()).toBeVisible()
  if (await accept.isVisible()) await accept.click()
  await expect(lessons).toBeVisible()
}

const startActivity = async (page: Page, title: string) => {
  await stage(page).getByRole('button', { name: 'Elige una lección' }).click()
  await stage(page)
    .getByRole('button', { name: new RegExp(`^Abrir: ${title}`) })
    .click()
  await stage(page).getByRole('button', { name: 'Empezar', exact: true }).click()
}

const check = (page: Page) => stage(page).getByRole('button', { name: 'Comprobar' })
const nextStep = (page: Page) => stage(page).getByRole('button', { name: 'Siguiente', exact: true })

test.describe('practice trainer', () => {
  test('the button exists only when the map has a trainer', async ({ page, context }) => {
    await open(page, context, {}, { trainer: false })
    await expect(app(page).getByRole('button', { name: 'Misiones' })).toBeVisible()
    await expect(hud(page)).toHaveCount(0)
  })

  test('opens with the notice once, closes with Esc and gives the focus back', async ({
    page,
    context,
  }) => {
    await open(page, context)
    await hud(page).click()
    await expect(stage(page).getByRole('heading', { name: 'Antes de empezar' })).toBeVisible({
      timeout: 20_000,
    })
    await expect(stage(page).getByText(/no usa inteligencia artificial/)).toBeVisible()
    // The microphone is never asked for.
    await expect(stage(page).getByText(/micr[oó]fono/i)).toHaveCount(0)
    await stage(page).getByRole('button', { name: 'Entendido, empezar' }).click()
    await expect(stage(page).getByRole('button', { name: 'Elige una lección' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(stage(page)).toHaveCount(0)
    await expect(hud(page)).toBeFocused()
    // The acceptance is remembered: the notice does not come back.
    await hud(page).click()
    await expect(stage(page).getByRole('button', { name: 'Elige una lección' })).toBeVisible()
    await expect(stage(page).getByText('Antes de empezar')).toHaveCount(0)
    await stage(page).getByRole('button', { name: 'Volver al mapa' }).click()
    await expect(stage(page)).toHaveCount(0)
  })

  test('lists lessons by module', async ({ page, context }) => {
    await open(page, context)
    await openStage(page)
    await stage(page).getByRole('button', { name: 'Elige una lección' }).click()
    await expect(stage(page).getByRole('heading', { name: /Módulo I/ })).toBeVisible()
    await expect(stage(page).getByText('Presentarse')).toBeVisible()
  })

  test('a grammar run through every step type, then the summary', async ({ page, context }) => {
    // Every step type in one run, on a cold dev server: slower than the rest.
    test.slow()
    const server = await open(page, context)
    await openStage(page)
    await startActivity(page, 'Verb to be')

    // mcq
    await expect(stage(page).getByText('Paso 1 de 4')).toBeVisible()
    await expect(check(page)).toBeDisabled()
    await stage(page).getByRole('radio', { name: 'is' }).check()
    await check(page).click()
    await expect(stage(page).getByText('Con she usamos is.')).toBeVisible()
    await expect(stage(page).getByText('Correcto', { exact: true })).toBeVisible()
    await nextStep(page).click()

    // gap_fill: a choice and a typed blank
    await stage(page).getByLabel('Espacio 1').selectOption('am')
    await stage(page).getByLabel('Espacio 2').fill('Colombia')
    await check(page).click()
    await nextStep(page).click()

    // reorder by taps, then take one back
    await stage(page).getByRole('button', { name: 'Poner I' }).click()
    await stage(page).getByRole('button', { name: 'Poner am' }).click()
    await stage(page).getByRole('button', { name: 'Poner student' }).click()
    await stage(page).getByRole('button', { name: 'Quitar student' }).click()
    await stage(page).getByRole('button', { name: 'Poner a' }).click()
    await stage(page).getByRole('button', { name: 'Poner student' }).click()
    await check(page).click()
    await expect(stage(page).getByText('Correcto', { exact: true })).toBeVisible()
    await nextStep(page).click()

    // match: one of each side
    await stage(page).getByRole('button', { name: 'cat', exact: true }).click()
    await stage(page).getByRole('button', { name: 'gato', exact: true }).click()
    await stage(page).getByRole('button', { name: 'dog', exact: true }).click()
    await stage(page).getByRole('button', { name: 'perro', exact: true }).click()
    await check(page).click()
    await stage(page).getByRole('button', { name: 'Terminar' }).click()

    await expect(stage(page).getByRole('heading', { name: 'Resumen de la práctica' })).toBeVisible()
    await expect(stage(page).getByText('4 de 4 correctas')).toBeVisible()
    await expect(stage(page).getByRole('button', { name: 'Siguiente actividad' })).toBeVisible()
    expect(server.practice.gradedCount).toBe(4)
  })

  test('a failed answer keeps what was chosen and retries with the same attempt id', async ({
    page,
    context,
  }) => {
    const server = await open(page, context, { practice: { failAnswers: 1 } })
    await openStage(page)
    await startActivity(page, 'Verb to be')
    await stage(page).getByRole('radio', { name: 'is' }).check()
    await check(page).click()
    await expect(stage(page).getByText('No pudimos comprobar tu respuesta.').first()).toBeVisible()
    await expect(stage(page).getByText('Tu respuesta sigue aquí; no se perdió.')).toBeVisible()
    await expect(stage(page).getByRole('radio', { name: 'is' })).toBeChecked()
    await stage(page).getByRole('button', { name: 'Reintentar' }).click()
    await expect(stage(page).getByText('Con she usamos is.')).toBeVisible()
    const attempts = server.calls
      .filter((c) => c.method === 'POST' && /\/answers$/.test(c.path))
      .map((c) => (c.body as { attempt_id: string }).attempt_id)
    expect(attempts).toHaveLength(2)
    expect(attempts[0]).toBe(attempts[1])
    expect(server.practice.gradedCount).toBe(1)
  })

  test('a written answer shows the closest answer and what changes, not a grade', async ({
    page,
    context,
  }) => {
    await open(page, context)
    await openStage(page)
    await startActivity(page, 'Escribe sobre ti')
    await stage(page).getByLabel('Escribe tu respuesta').fill('I am student')
    await check(page).click()
    await expect(stage(page).getByText('La respuesta más cercana', { exact: true })).toBeVisible()
    await expect(stage(page).getByText('I am a student', { exact: true })).toBeVisible()
    await expect(stage(page).getByText('Comparación')).toBeVisible()
    await expect(stage(page).getByText('Falta: a')).toBeAttached()
    await expect(stage(page).getByText('Usa a antes de una profesión.')).toBeVisible()
  })

  test('the guided dialogue: a role, a choice, the translation on request, starters', async ({
    page,
    context,
  }) => {
    await open(page, context)
    await openStage(page)
    await stage(page).getByRole('button', { name: 'Elige una lección' }).click()
    await stage(page)
      .getByRole('button', { name: /^Abrir: En el hotel/ })
      .click()
    await expect(stage(page).getByText('Tu papel: Recepcionista')).toBeVisible()
    // Never a name for the partner and never "IA".
    await expect(stage(page).getByText(/\bIA\b/)).toHaveCount(0)
    await stage(page).getByRole('button', { name: 'Empezar', exact: true }).click()
    await expect(stage(page).getByText('Good evening. Do you have a reservation?')).toBeVisible()
    await expect(stage(page).getByText('Buenas noches')).toHaveCount(0)
    await stage(page).getByRole('button', { name: 'Ver en español' }).click()
    await expect(stage(page).getByText('Buenas noches. ¿Tiene una reserva?')).toBeVisible()
    await stage(page).getByRole('radio', { name: 'Yes, I do.' }).check()
    await check(page).click()
    await expect(stage(page).getByText('Respuesta recibida')).toBeVisible()
    await nextStep(page).click()
    // Typed turn with a starter and a word from the bank.
    await stage(page).getByRole('button', { name: 'Usar: My name is' }).click()
    await stage(page).getByRole('button', { name: 'Ana', exact: true }).click()
    await expect(stage(page).getByLabel('Escribe tu respuesta')).toHaveValue('My name is Ana')
    await check(page).click()
    await stage(page).getByRole('button', { name: 'Terminar' }).click()
    await expect(stage(page).getByRole('heading', { name: 'Resumen de la práctica' })).toBeVisible()
  })

  test('B2 and A2 fixtures render the same screens with less help', async ({ page, context }) => {
    await open(page, context, { practice: { level: 'B2' } })
    await openStage(page)
    await expect(stage(page).getByText('Nivel B2')).toBeVisible()
    await stage(page).getByRole('button', { name: 'Elige una lección' }).click()
    await stage(page)
      .getByRole('button', { name: /^Abrir: En el hotel/ })
      .click()
    await stage(page).getByRole('button', { name: 'Empezar', exact: true }).click()
    await expect(stage(page).getByText('Good evening. Do you have a reservation?')).toBeVisible()
    // No translation on request at B2, and the choices still work.
    await expect(stage(page).getByRole('button', { name: 'Ver en español' })).toHaveCount(0)
    await stage(page).getByRole('radio', { name: 'Yes, I do.' }).check()
    await check(page).click()
    await nextStep(page).click()
    // The typed turn has no starters and no word bank, but is answerable.
    await expect(stage(page).getByRole('button', { name: 'Usar: My name is' })).toHaveCount(0)
    await expect(stage(page).getByRole('button', { name: 'Ana', exact: true })).toHaveCount(0)
    await stage(page).getByLabel('Escribe tu respuesta').fill('My name is Ana')
    await expect(check(page)).toBeEnabled()
  })

  test('reorder and match work from the keyboard', async ({ page, context }) => {
    await open(page, context)
    await openStage(page)
    await startActivity(page, 'Verb to be')
    await stage(page).getByRole('radio', { name: 'is' }).check()
    await check(page).click()
    await nextStep(page).click()
    await stage(page).getByLabel('Espacio 1').selectOption('am')
    await stage(page).getByLabel('Espacio 2').fill('Colombia')
    await check(page).click()
    await nextStep(page).click()
    // Reorder: focus a word and press Enter, then Space on the placed one to take it back.
    const word = (name: string) => stage(page).getByRole('button', { name })
    await word('Poner I').focus()
    await page.keyboard.press('Enter')
    await expect(word('Quitar I')).toBeVisible()
    await word('Quitar I').focus()
    await page.keyboard.press('Space')
    await expect(word('Poner I')).toBeVisible()
    for (const name of ['Poner I', 'Poner am', 'Poner a', 'Poner student']) {
      await word(name).focus()
      await page.keyboard.press('Enter')
    }
    await check(page).focus()
    await page.keyboard.press('Enter')
    await expect(stage(page).getByText('Correcto', { exact: true })).toBeVisible()
    await nextStep(page).focus()
    await page.keyboard.press('Enter')
    // Match: select one on each side with the keyboard.
    for (const name of ['cat', 'gato', 'dog', 'perro']) {
      await stage(page).getByRole('button', { name, exact: true }).focus()
      await page.keyboard.press('Enter')
    }
    // The pair is shown on both sides.
    await expect(stage(page).getByRole('button', { name: 'cat con gato' })).toHaveCount(2)
    await expect(
      stage(page).getByRole('button', { name: 'Deshacer la pareja de dog' })
    ).toBeVisible()
    await expect(check(page)).toBeEnabled()
  })

  test('the listening step plays on a click', async ({ page, context }) => {
    await open(page, context)
    await openStage(page)
    await startActivity(page, 'Escucha: saludos')
    await expect(stage(page).getByRole('radio', { name: 'Good morning' })).toBeVisible()
    await expect(
      stage(page)
        .getByRole('button', { name: /Escuchar|Reproducir/ })
        .first()
    ).toBeVisible()
  })

  test('reviews due words and records each answer once', async ({ page, context }) => {
    const server = await open(page, context, { practice: { dueWords: 2 } })
    await openStage(page)
    await stage(page).getByRole('button', { name: 'Mi progreso' }).click()
    await stage(page).getByRole('button', { name: 'Repasar palabras' }).click()
    await expect(stage(page).getByText('Palabra 1 de 2')).toBeVisible()
    await expect(stage(page).getByRole('button', { name: 'La sabía' })).toHaveCount(0)
    await stage(page).getByRole('button', { name: 'Ver traducción' }).click()
    await stage(page).getByRole('button', { name: 'La sabía', exact: true }).click()
    await expect(stage(page).getByText('Palabra 2 de 2')).toBeVisible()
    await stage(page).getByRole('button', { name: 'Ver traducción' }).click()
    await stage(page).getByRole('button', { name: 'No la sabía' }).click()
    await expect(stage(page).getByText('Terminaste el repaso.')).toBeVisible()
    expect(server.practice.reviews.map((r) => r.knew)).toEqual([true, false])
    expect(new Set(server.practice.reviews.map((r) => r.attempt)).size).toBe(2)
  })

  test('progress by skill and my vocabulary', async ({ page, context }) => {
    await open(page, context)
    await openStage(page)
    await stage(page).getByRole('button', { name: 'Mi progreso' }).click()
    await expect(stage(page).getByText('3 de 10')).toBeVisible()
    await expect(stage(page).getByText('hello')).toBeVisible()
  })

  test('an editor sees the preview banner', async ({ page, context }) => {
    await open(
      page,
      context,
      { practice: { preview: true, unpublished: true } },
      { role: 'editor' }
    )
    await openStage(page)
    await expect(stage(page).getByText('Vista previa: no se guarda tu práctica')).toBeVisible()
  })

  test('the stage says plainly when the backend cannot be reached, and Volver al mapa works', async ({
    page,
    context,
  }) => {
    await open(page, context, { practice: { catalogStatus: 503 } })
    await hud(page).click()
    await expect(stage(page).getByText('No pudimos cargar el entrenamiento.')).toBeVisible({
      timeout: 20_000,
    })
    await expect(stage(page).getByRole('button', { name: 'Reintentar' })).toBeVisible()
    await stage(page).getByRole('button', { name: 'Volver al mapa' }).click()
    await expect(stage(page)).toHaveCount(0)
  })

  test('Entrenar is practice only: no final exam entry, even when the backend lists one', async ({
    page,
    context,
  }) => {
    await open(page, context)
    await openStage(page)
    await expect(stage(page).getByRole('button', { name: /Elige una lección/ })).toBeVisible()
    await expect(stage(page).getByText('Evaluación final')).toHaveCount(0)
    await expect(stage(page).getByRole('button', { name: 'Abrir' })).toHaveCount(0)
  })
})

for (const [width, height] of [
  [360, 740],
  [1366, 768],
  [1280, 640],
] as const) {
  test(`${width}x${height}: the practice card fits and the footer stays pinned`, async ({
    page,
    context,
  }) => {
    await open(page, context, {}, { size: [width, height] })
    await openStage(page)
    await startActivity(page, 'Verb to be')
    await stage(page).getByRole('radio', { name: 'is' }).check()
    await check(page).click()
    await expect(stage(page).getByText('Con she usamos is.')).toBeVisible()
    const m = await app(page)
      .locator('body')
      .evaluate(() => {
        for (const a of document.getAnimations()) a.finish()
        const card = document.querySelector<HTMLElement>('.flow-card')!
        const foot = card.querySelector<HTMLElement>('footer')!
        const scroller = card.querySelector<HTMLElement>('.flow-card-scroll')!
        const c = card.getBoundingClientRect()
        const f = foot.getBoundingClientRect()
        const small = [...card.querySelectorAll<HTMLElement>('button')]
          .filter((el) => {
            const r = el.getBoundingClientRect()
            return r.width > 0 && r.height > 0 && r.height < 43.5
          })
          .map((el) => (el.textContent ?? '').trim().slice(0, 20))
        return {
          sideways: document.documentElement.scrollWidth - innerWidth,
          scroller: scroller.scrollWidth - scroller.clientWidth,
          card: card.scrollWidth - card.clientWidth,
          over: c.height - innerHeight,
          footGap: Math.abs(c.bottom - f.bottom),
          footVisible: f.top >= 0 && f.bottom <= innerHeight + 1,
          // Nothing of ours in the host's top-right 96x96 corner.
          corner: [...card.querySelectorAll<HTMLElement>('button, a, input')].filter((el) => {
            const r = el.getBoundingClientRect()
            return r.width > 0 && r.right > innerWidth - 96 && r.top < 96
          }).length,
          small,
        }
      })
    expect(m.sideways).toBe(0)
    expect(m.scroller).toBe(0)
    expect(m.card).toBe(0)
    expect(m.over).toBeLessThanOrEqual(1)
    expect(m.footGap).toBeLessThanOrEqual(1)
    expect(m.footVisible).toBe(true)
    expect(m.corner).toBe(0)
    expect(m.small).toEqual([])
  })
}
