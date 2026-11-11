import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { fitVideoPanel, PANEL_RATIO } from './videoPanelFit.ts'

describe('fitVideoPanel', () => {
  const cases: Array<{
    name: string
    availWidth: number
    availHeight: number
    expected: { width: number; height: number } | null
  }> = [
    // Width-driven when there is room.
    {
      name: 'a tall desktop',
      availWidth: 640,
      availHeight: 800,
      expected: { width: 640, height: 360 },
    },
    {
      name: 'a narrow phone',
      availWidth: 328,
      availHeight: 640,
      expected: { width: 328, height: 185 },
    },
    // Capped by the room left in height: (500 - 160) * 16/9 = 604.
    {
      name: 'a 500 px tall iframe',
      availWidth: 640,
      availHeight: 500,
      expected: { width: 604, height: 340 },
    },
    // The minimum wins over the height cap; the curtain scrolls instead.
    {
      name: 'a 300 px tall iframe',
      availWidth: 640,
      availHeight: 300,
      expected: { width: 281, height: 158 },
    },
    {
      name: 'a 200 px tall iframe',
      availWidth: 640,
      availHeight: 200,
      expected: { width: 281, height: 158 },
    },
    {
      name: 'no room left at all',
      availWidth: 640,
      availHeight: 100,
      expected: { width: 281, height: 158 },
    },
    // A container narrower than the minimum is not overflowed by it.
    {
      name: 'a container of 100 px',
      availWidth: 100,
      availHeight: 800,
      expected: { width: 100, height: 56 },
    },
    // No real measurement yet: keep the CSS fallback.
    { name: 'zero width', availWidth: 0, availHeight: 600, expected: null },
    { name: 'zero height', availWidth: 640, availHeight: 0, expected: null },
    { name: 'negative width', availWidth: -4, availHeight: 600, expected: null },
    { name: 'NaN height', availWidth: 640, availHeight: Number.NaN, expected: null },
    { name: 'infinite width', availWidth: Infinity, availHeight: 600, expected: null },
  ]
  for (const { name, availWidth, availHeight, expected } of cases) {
    it(name, () => {
      assert.deepEqual(fitVideoPanel({ availWidth, availHeight }), expected)
    })
  }

  it('keeps 16:9 within 2% wherever it returns a size and fits', () => {
    for (let h = 150; h <= 1000; h += 25) {
      for (let w = 300; w <= 700; w += 25) {
        const size = fitVideoPanel({ availWidth: w, availHeight: h })
        assert.ok(size)
        assert.ok(size.width >= 280 && size.height >= 158, `${w}x${h}`)
        assert.ok(Math.abs(size.width / size.height - PANEL_RATIO) / PANEL_RATIO < 0.02)
      }
    }
  })

  it('honours another ratio and another minimum', () => {
    assert.deepEqual(
      fitVideoPanel({
        availWidth: 640,
        availHeight: 800,
        ratio: 4 / 3,
        minWidth: 200,
        minHeight: 100,
      }),
      { width: 640, height: 480 }
    )
  })
})
