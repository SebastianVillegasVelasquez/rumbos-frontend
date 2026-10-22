import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { CORNER, hudMetrics, overlaps, type HudInput, type Rect } from './metrics.ts'

const widths = [320, 360, 375, 390, 412, 479, 480, 540, 600, 640, 720, 768, 844, 1024, 1280, 1920]
const heights = [320, 360, 390, 568, 640, 800, 900]

const grid = function* () {
  for (const width of widths)
    for (const height of heights)
      for (const guardsTouch of [false, true])
        for (const hasLevelsButton of [false, true])
          for (const hasPreviewPill of [false, true])
            for (const clusterButtons of [3, 6]) {
              const input: HudInput = {
                width,
                height,
                guardsTouch,
                hasLevelsButton,
                hasPreviewPill,
                clusterButtons,
              }
              yield input
            }
}

const describeInput = (input: HudInput) => JSON.stringify(input)

describe('hudMetrics', () => {
  it('never lets anything touch the corner the host reserves', () => {
    for (const input of grid()) {
      const { rects } = hudMetrics(input)
      for (const [name, rect] of Object.entries(rects)) {
        if (name === 'corner' || !rect) continue
        assert.equal(
          overlaps(rect as Rect, rects.corner),
          false,
          `${name} enters the corner at ${describeInput(input)}`
        )
      }
    }
  })

  it('keeps the HUD controls from overlapping each other', () => {
    const names = ['topLeft', 'chip', 'pill', 'cluster', 'guard', 'continue'] as const
    for (const input of grid()) {
      // Phone-sized portrait or landscape only; a 320 px-wide, 900 px-tall
      // window is not a real device, but it is still checked.
      const { rects } = hudMetrics(input)
      for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
          const a = rects[names[i]]
          const b = rects[names[j]]
          if (!a || !b) continue
          assert.equal(
            overlaps(a, b),
            false,
            `${names[i]} overlaps ${names[j]} at ${describeInput(input)}`
          )
        }
      }
    }
  })

  it('keeps every control inside the viewport', () => {
    for (const input of grid()) {
      const { rects } = hudMetrics(input)
      for (const [name, rect] of Object.entries(rects)) {
        if (!rect) continue
        assert.ok(
          rect.x >= 0 &&
            rect.y >= 0 &&
            rect.x + rect.w <= input.width &&
            rect.y + rect.h <= input.height,
          `${name} leaves the viewport at ${describeInput(input)}`
        )
      }
    }
  })

  it('moves the level chip to the top below 480 px, at most min(60vw, 280px)', () => {
    const narrow = hudMetrics({ ...base, width: 360 })
    assert.equal(narrow.chipOnTop, true)
    assert.ok(narrow.chipMaxWidth <= Math.min(360 * 0.6, 280))
    const wide = hudMetrics({ ...base, width: 480 })
    assert.equal(wide.chipOnTop, false)
  })

  it('wraps the cluster into a second column on short screens', () => {
    const landscape = hudMetrics({ ...base, width: 640, height: 360, clusterButtons: 6 })
    assert.equal(landscape.clusterColumns, 2)
    const portrait = hudMetrics({ ...base, width: 360, height: 640, clusterButtons: 6 })
    assert.equal(portrait.clusterColumns, 1)
    assert.ok(landscape.rects.cluster.y >= CORNER)
  })

  it('keeps "Continuar" readable at the smallest sizes', () => {
    for (const input of grid()) {
      if (input.clusterButtons > 6) continue
      const metrics = hudMetrics(input)
      assert.ok(
        !metrics.continueIconOnly,
        `no room for the label at ${describeInput(input)} (${metrics.continueMaxWidth}px)`
      )
    }
  })

  it('every control is at least 44 px', () => {
    const { rects } = hudMetrics({ ...base, width: 360, height: 640, guardsTouch: true })
    for (const rect of [rects.topLeft, rects.guard, rects.continue]) {
      assert.ok(rect && rect.h >= 44 && rect.w >= 44)
    }
  })
})

const base: HudInput = {
  width: 360,
  height: 640,
  guardsTouch: false,
  clusterButtons: 6,
  hasLevelsButton: true,
  hasPreviewPill: false,
}
