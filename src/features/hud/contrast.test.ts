import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

// WCAG 2.x relative luminance and contrast, applied to the level chip: white
// text on the translucent scrim, measured over the map behind it (unknown, so
// the extremes and the middle), at full opacity and at its dimmed opacity.

const tokens = readFileSync(new URL('../../styles/tokens.css', import.meta.url), 'utf8')

const scrimMatch = tokens.match(/--hud-scrim:\s*rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)/)
const dimMatch = tokens.match(/--hud-dim-chip:\s*([\d.]+)/)
assert.ok(scrimMatch && dimMatch, 'HUD tokens are missing')
const scrim = {
  rgb: [Number(scrimMatch[1]), Number(scrimMatch[2]), Number(scrimMatch[3])] as const,
  alpha: Number(scrimMatch[4]),
}
const dimOpacity = Number(dimMatch[1])

const channel = (value: number) => {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}
const luminance = (rgb: readonly number[]) =>
  0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2])
const contrast = (a: readonly number[], b: readonly number[]) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
const mix = (top: readonly number[], bottom: readonly number[], alpha: number) =>
  top.map((value, i) => value * alpha + bottom[i] * (1 - alpha))

const WHITE = [255, 255, 255]
const maps: [string, number[]][] = [
  ['white map', [255, 255, 255]],
  ['mid-gray map', [128, 128, 128]],
  ['black map', [0, 0, 0]],
  ['yellow map', [255, 230, 120]],
  ['sky map', [150, 210, 255]],
]

describe('level chip contrast against its scrim', () => {
  for (const [name, map] of maps) {
    it(`meets AA (4.5:1) at full opacity over a ${name}`, () => {
      const background = mix(scrim.rgb, map, scrim.alpha)
      assert.ok(contrast(WHITE, background) >= 4.5, `${contrast(WHITE, background)}`)
    })

    it(`still meets AA when dimmed over a ${name}`, () => {
      // The whole chip fades: text and scrim are each composited over the map.
      const background = mix(mix(scrim.rgb, map, scrim.alpha), map, dimOpacity)
      const text = mix(WHITE, map, dimOpacity)
      assert.ok(contrast(text, background) >= 4.5, `${contrast(text, background)}`)
    })
  }

  it('the controls dim to 45 percent and the chip stays above them', () => {
    const controls = tokens.match(/--hud-dim-controls:\s*([\d.]+)/)
    assert.equal(Number(controls?.[1]), 0.45)
    assert.ok(dimOpacity > 0.45)
  })
})
