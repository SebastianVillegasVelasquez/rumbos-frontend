import { expect, test, type Page } from '@playwright/test'

// The editor shell (top bar, left rail, full-view sections) in the standalone app against the
// mock backend: structure, behaviour and responsive limits. Layout only; see
// docs/DECISIONS-editor-shell.md.

const rail = (page: Page) => page.getByRole('navigation', { name: 'Secciones del editor' })
const railButton = (page: Page, name: RegExp) => rail(page).getByRole('button', { name })
const back = (page: Page) => page.getByRole('button', { name: 'Volver al mapa' })
const zoomLabel = (page: Page) => page.getByText(/^\d+%$/).first()

const openEditor = async (page: Page, width: number, height = 760) => {
  await page.setViewportSize({ width, height })
  await page.goto('/')
  await page.getByText('Fundamentos de programación').first().click()
  await page.locator('[data-level-open]').first().click()
  await rail(page).waitFor()
}

// Pixels the page is wider than the viewport, and the visible elements that stick out of it.
const horizontalOverflow = (page: Page) =>
  page.evaluate(() => {
    const doc = document.documentElement.scrollWidth - window.innerWidth
    const offenders: string[] = []
    document.querySelectorAll('body *').forEach((el) => {
      const r = el.getBoundingClientRect()
      const hidden = getComputedStyle(el).visibility === 'hidden'
      if (!hidden && r.width > 0 && r.right > window.innerWidth + 1)
        offenders.push(`${el.tagName}.${String(el.className).slice(0, 40)}`)
    })
    return { doc, offenders: offenders.slice(0, 5) }
  })

// Visible controls smaller than 40px on either side.
const smallTargets = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('button, a[href], select, [role=radio]')]
      .filter((el) => {
        const r = el.getBoundingClientRect()
        const style = getComputedStyle(el)
        return (
          r.width > 0 &&
          r.height > 0 &&
          style.visibility !== 'hidden' &&
          (r.height < 39.5 || r.width < 39.5)
        )
      })
      .map(
        (el) =>
          `${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)} ${Math.round(
            el.getBoundingClientRect().width
          )}x${Math.round(el.getBoundingClientRect().height)}`
      )
  )

const openAppearanceTab = async (page: Page, tab: string) => {
  await railButton(page, /^Apariencia/).click()
  const wide = (page.viewportSize()?.width ?? 0) >= 520
  if (wide) {
    await page
      .getByRole('navigation', { name: 'Subsecciones' })
      .getByRole('button', { name: tab, exact: true })
      .click()
  } else {
    await page
      .getByRole('region', { name: 'Apariencia' })
      .getByRole('combobox')
      .first()
      .selectOption({ label: tab })
  }
}

test.describe('top bar', () => {
  test('fits in one 48px row at 600px with every control on it', async ({ page }) => {
    await openEditor(page, 600)
    const header = page.locator('header').first()
    const box = (await header.boundingBox())!
    expect(box.height).toBeLessThanOrEqual(48)
    for (const control of [
      page.getByRole('radio', { name: 'Edición' }),
      page.getByRole('radio', { name: 'Vista previa', exact: true }),
      page.getByRole('status').first(),
      page.getByRole('button', { name: 'Guardar', exact: true }),
      page.getByRole('button', { name: 'Más acciones' }),
      page.getByRole('button', { name: 'Pantalla completa' }),
    ]) {
      const b = (await control.boundingBox())!
      expect(b.y).toBeGreaterThanOrEqual(box.y - 1)
      expect(b.y + b.height).toBeLessThanOrEqual(box.y + box.height + 1)
      expect(b.x + b.width).toBeLessThanOrEqual(601)
    }
    expect((await horizontalOverflow(page)).doc).toBe(0)
  })

  test('has two view modes (no "Guardado" tab) and says the save state once', async ({ page }) => {
    await openEditor(page, 1000)
    await expect(page.getByRole('radio')).toHaveCount(2)
    await expect(page.getByRole('radio', { name: 'Guardado' })).toHaveCount(0)
    await expect(page.getByRole('status').filter({ hasText: /guardado/i })).toHaveCount(1)
    await expect(page.getByRole('status').first()).toHaveText(/^v\d+ guardado$/)
  })

  test('the fullscreen button is icon-only with a tooltip', async ({ page }) => {
    await openEditor(page, 1000)
    const button = page.getByRole('button', { name: 'Pantalla completa' })
    await expect(button).toHaveAttribute('title', 'Pantalla completa')
    await expect(button).toHaveText('')
  })

  test('Versiones guardadas and Descartar cambios live in the ⋯ menu', async ({ page }) => {
    await openEditor(page, 1000)
    await expect(page.getByRole('button', { name: /Versiones guardadas/ })).toHaveCount(0)
    await page.getByRole('button', { name: 'Más acciones' }).click()
    await expect(page.getByRole('menuitem', { name: 'Versiones guardadas' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: /Descartar cambios/ })).toBeVisible()
  })

  test('Guardar is disabled only while there is nothing to save', async ({ page }) => {
    await openEditor(page, 1000)
    const save = page.getByRole('button', { name: 'Guardar', exact: true })
    await expect(save).toBeDisabled()
    // It still looks like the primary action: solid, not faded.
    expect(await save.evaluate((el) => getComputedStyle(el).opacity)).toBe('1')
    // A change in the level (a bubble moved/added) turns it on.
    await openAppearanceTab(page, 'Cierre')
    await page
      .getByRole('button', { name: /Actividad de Moodle/ })
      .first()
      .click()
    await back(page).click()
    // Appearance edits wait for the studio's own Guardar; the rail flags them.
    await expect(railButton(page, /^Apariencia/)).toHaveAccessibleName(/sin guardar/)
  })
})

test.describe('rail', () => {
  test('shows icon + label at 64px on a wide bar', async ({ page }) => {
    await openEditor(page, 1000)
    const box = (await rail(page).boundingBox())!
    expect(Math.round(box.width)).toBe(64)
    for (const name of ['Mapa', 'Actividades', 'Niveles', 'Apariencia', 'Resumen']) {
      await expect(rail(page).getByText(name, { exact: true })).toBeVisible()
    }
    await expect(railButton(page, /^Mapa$/)).toHaveAttribute('aria-current', 'page')
  })

  test('collapses to icons only below 520px', async ({ page }) => {
    await openEditor(page, 400)
    const box = (await rail(page).boundingBox())!
    expect(box.width).toBeLessThanOrEqual(48)
    // Visually hidden, a clipped 1 px box. WebKit still counts that box as in the viewport.
    const label = (await rail(page).getByText('Apariencia', { exact: true }).boundingBox())!
    expect(label.width).toBeLessThanOrEqual(1)
    expect(label.height).toBeLessThanOrEqual(1)
    // Still reachable by name.
    await expect(railButton(page, /^Apariencia/)).toBeVisible()
  })

  test('marks the active item and the count of activities not yet placed', async ({ page }) => {
    await openEditor(page, 1000)
    await railButton(page, /^Resumen/).click()
    await expect(railButton(page, /^Resumen/)).toHaveAttribute('aria-current', 'page')
    await expect(railButton(page, /^Mapa$/)).not.toHaveAttribute('aria-current', 'page')
  })
})

test.describe('sections', () => {
  test('a section replaces the map at full size, with its title and a way back', async ({
    page,
  }) => {
    await openEditor(page, 1000)
    await expect(zoomLabel(page)).toBeVisible()
    await railButton(page, /^Resumen/).click()
    const section = page.getByRole('region', { name: 'Resumen' })
    await expect(section.getByRole('heading', { name: 'Resumen' })).toBeVisible()
    await expect(zoomLabel(page)).not.toBeVisible()
    // The rail stays, and the content fills the area beside it and under the bar.
    await expect(rail(page)).toBeVisible()
    const s = (await section.boundingBox())!
    const r = (await rail(page).boundingBox())!
    expect(Math.round(s.x)).toBe(Math.round(r.x + r.width))
    expect(Math.round(s.x + s.width)).toBe(1000)
    await back(page).click()
    await expect(zoomLabel(page)).toBeVisible()
  })

  test('switches sections straight from the rail, without going back to the map', async ({
    page,
  }) => {
    await openEditor(page, 1000)
    await railButton(page, /^Resumen/).click()
    await railButton(page, /^Apariencia/).click()
    await expect(page.getByRole('region', { name: 'Apariencia' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Resumen' })).toBeHidden()
  })

  test('keeps the map zoom through a trip into a section and back', async ({ page }) => {
    await openEditor(page, 1000)
    await page.getByRole('button', { name: 'Acercar' }).click()
    // The zoom eases to its value: wait until it stops changing. A fixed wait is not enough
    // on a slow machine.
    let last = ''
    await expect
      .poll(
        async () => {
          const previous = last
          last = await zoomLabel(page).innerText()
          return last !== '100%' && last === previous
        },
        { intervals: [500], timeout: 15_000 }
      )
      .toBe(true)
    const zoomed = await zoomLabel(page).innerText()
    expect(zoomed).not.toBe('100%')
    await railButton(page, /^Apariencia/).click()
    await back(page).click()
    await expect(zoomLabel(page)).toHaveText(zoomed)
  })

  test('Actividades leaves the map on screen so activities can still be dragged onto it', async ({
    page,
  }) => {
    await openEditor(page, 1000)
    await railButton(page, /^Actividades/).click()
    const panel = page.getByRole('region', { name: 'Actividades' })
    await expect(panel).toBeVisible()
    await expect(zoomLabel(page)).toBeVisible()
    const p = (await panel.boundingBox())!
    const z = (await zoomLabel(page).boundingBox())!
    // A strip beside the map, not on top of it.
    expect(p.width).toBeLessThan(300)
    expect(z.x).toBeGreaterThan(p.x + p.width)
  })

  test('Actividades is a strip under the map on a narrow bar', async ({ page }) => {
    await openEditor(page, 400)
    await railButton(page, /^Actividades/).click()
    const panel = page.getByRole('region', { name: 'Actividades' })
    const p = (await panel.boundingBox())!
    const z = (await zoomLabel(page).boundingBox())!
    expect(z.y + z.height).toBeLessThanOrEqual(p.y + 1)
    expect(p.width).toBeGreaterThan(300)
  })

  test('remembers the last section between sessions', async ({ page }) => {
    await openEditor(page, 1000)
    await railButton(page, /^Resumen/).click()
    await page.reload()
    await rail(page).waitFor()
    await expect(railButton(page, /^Resumen/)).toHaveAttribute('aria-current', 'page')
    await railButton(page, /^Mapa$/).click()
    await page.reload()
    await rail(page).waitFor()
    await expect(railButton(page, /^Mapa$/)).toHaveAttribute('aria-current', 'page')
  })
})

test.describe('Apariencia sub-navigation', () => {
  test('is a 150px vertical list with the ten entries that never wrap', async ({ page }) => {
    await openEditor(page, 1000)
    await railButton(page, /^Apariencia/).click()
    const list = page.getByRole('navigation', { name: 'Subsecciones' })
    await expect(list).toBeVisible()
    expect(Math.round((await list.boundingBox())!.width)).toBe(150)
    const items = list.getByRole('button')
    expect(await items.count()).toBeGreaterThanOrEqual(8)
    const tops = await items.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top))
    expect(new Set(tops.map(Math.round)).size).toBe(tops.length)
    await list.getByRole('button', { name: 'Ambiente', exact: true }).click()
    await expect(list.getByRole('button', { name: 'Ambiente' })).toHaveAttribute(
      'aria-current',
      'page'
    )
  })

  test('becomes a dropdown below 520px', async ({ page }) => {
    await openEditor(page, 400)
    await railButton(page, /^Apariencia/).click()
    await expect(page.getByRole('navigation', { name: 'Subsecciones' })).toBeHidden()
    const select = page.getByRole('region', { name: 'Apariencia' }).getByRole('combobox').first()
    await expect(select).toBeVisible()
    await select.selectOption({ label: 'Ambiente' })
    await expect(select).toHaveValue('ambient')
  })
})

test.describe('step cards', () => {
  const addStep = async (page: Page) => {
    await openAppearanceTab(page, 'Cierre')
    await page
      .getByRole('button', { name: /Actividad de Moodle/ })
      .first()
      .click()
  }

  test('keep move / duplicate / delete inside the card when it is wide enough', async ({
    page,
  }) => {
    await openEditor(page, 1000)
    await addStep(page)
    const card = page.locator('li.\\@container').first()
    await expect(card.getByRole('button', { name: /^Subir paso/ })).toBeVisible()
    await expect(card.getByRole('button', { name: /^Bajar paso/ })).toBeVisible()
    await expect(card.getByRole('button', { name: /^Duplicar paso/ })).toBeVisible()
    await expect(card.getByRole('button', { name: /^Eliminar paso/ })).toBeVisible()
    await expect(card.getByRole('button', { name: /^Más acciones/ })).toBeHidden()
    const c = (await card.boundingBox())!
    for (const b of await card.getByRole('button', { name: /paso/ }).all()) {
      const bb = (await b.boundingBox())!
      expect(bb.x + bb.width).toBeLessThanOrEqual(c.x + c.width + 1)
    }
  })

  test('fold into a ⋯ menu below 480px and still do their job', async ({ page }) => {
    await openEditor(page, 600)
    await addStep(page)
    const card = page.locator('li.\\@container').first()
    await expect(card.getByRole('button', { name: /^Subir paso/ })).toBeHidden()
    await card.getByRole('button', { name: /^Más acciones/ }).click()
    await expect(page.getByRole('menuitem', { name: 'Subir paso' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Bajar paso' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Duplicar paso' })).toBeVisible()
    await page.getByRole('menuitem', { name: 'Duplicar paso' }).click()
    await expect(page.locator('li.\\@container')).toHaveCount(2)
  })

  test('the "agregar paso" buttons wrap inside the content area', async ({ page }) => {
    await openEditor(page, 400)
    await openAppearanceTab(page, 'Cierre')
    const add = page.getByRole('button', {
      name: /^Agregar|^\+?\s*(Video|Texto|Documento|Actividad)/,
    })
    const area = (await page.getByRole('region', { name: 'Apariencia' }).boundingBox())!
    for (const b of await add.all()) {
      const bb = (await b.boundingBox())!
      expect(bb.x + bb.width).toBeLessThanOrEqual(area.x + area.width + 1)
    }
  })
})

test.describe('scroll memory', () => {
  test('puts the content back where it was after a trip to the map', async ({ page }) => {
    await openEditor(page, 1000, 500)
    await openAppearanceTab(page, 'Cierre')
    for (let i = 0; i < 3; i++)
      await page
        .getByRole('button', { name: /Actividad de Moodle/ })
        .first()
        .click()
    const scroller = () =>
      page.evaluate(() => {
        const els = [
          ...document.querySelectorAll('section:not([hidden]) .overflow-y-auto'),
        ] as HTMLElement[]
        const el = els.find((e) => e.scrollHeight > e.clientHeight + 50)
        return el ? el.scrollTop : -1
      })
    await page.evaluate(() => {
      const els = [
        ...document.querySelectorAll('section:not([hidden]) .overflow-y-auto'),
      ] as HTMLElement[]
      const el = els.find((e) => e.scrollHeight > e.clientHeight + 50)
      if (el) el.scrollTop = 250
    })
    await expect.poll(scroller).toBe(250)
    await back(page).click()
    await railButton(page, /^Apariencia/).click()
    await expect.poll(scroller).toBe(250)
  })

  test('keeps unsaved Apariencia edits when switching sections', async ({ page }) => {
    await openEditor(page, 1000)
    await openAppearanceTab(page, 'Cierre')
    await page
      .getByRole('button', { name: /Actividad de Moodle/ })
      .first()
      .click()
    await railButton(page, /^Resumen/).click()
    await railButton(page, /^Apariencia/).click()
    await expect(page.locator('li.\\@container')).toHaveCount(1)
  })
})

test.describe('responsive limits', () => {
  for (const width of [360, 420, 520, 600, 768, 1200]) {
    test(`no horizontal scroll and no clipped controls at ${width}px`, async ({ page }) => {
      await openEditor(page, width)
      const sections = ['Mapa', 'Actividades', 'Niveles', 'Apariencia', 'Resumen']
      for (const name of sections) {
        await railButton(page, new RegExp(`^${name}`)).click()
        const { doc, offenders } = await horizontalOverflow(page)
        expect(doc, `${name}: ${offenders.join(' | ')}`).toBe(0)
        expect(offenders, name).toEqual([])
      }
      // Every Apariencia entry, one by one.
      await railButton(page, /^Apariencia/).click()
      const list = page.getByRole('navigation', { name: 'Subsecciones' })
      const names =
        width >= 520
          ? await list.getByRole('button').allInnerTexts()
          : await page
              .getByRole('region', { name: 'Apariencia' })
              .getByRole('combobox')
              .first()
              .locator('option')
              .allInnerTexts()
      for (const tab of names) {
        await openAppearanceTab(page, tab.trim())
        const { doc, offenders } = await horizontalOverflow(page)
        expect(doc, `Apariencia/${tab}: ${offenders.join(' | ')}`).toBe(0)
      }
    })
  }

  for (const width of [360, 600, 1000]) {
    test(`touch targets are at least 40px at ${width}px`, async ({ page }) => {
      await openEditor(page, width)
      expect(await smallTargets(page)).toEqual([])
      for (const name of ['Actividades', 'Apariencia', 'Resumen']) {
        await railButton(page, new RegExp(`^${name}`)).click()
        expect(await smallTargets(page), name).toEqual([])
      }
    })
  }

  test('the bar, the rail and the content area are fixed: only the content scrolls', async ({
    page,
  }) => {
    await openEditor(page, 600, 420)
    await railButton(page, /^Apariencia/).click()
    expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBe(0)
    const before = (await page.locator('header').first().boundingBox())!.y
    await page.mouse.move(400, 300)
    await page.mouse.wheel(0, 600)
    expect((await page.locator('header').first().boundingBox())!.y).toBe(before)
    expect((await rail(page).boundingBox())!.y).toBeGreaterThan(0)
  })
})
