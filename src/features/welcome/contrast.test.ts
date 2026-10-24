import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

// WCAG AA for the curtain's text: white over the scrim, over the blurred map
// behind it. The map is unknown, so the extremes and the middle are measured.

const tokens = readFileSync(new URL('../../styles/tokens.css', import.meta.url), 'utf8')
const match = tokens.match(/--welcome-scrim:\s*rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)/)
assert.ok(match, 'the welcome scrim token is missing')
const scrim = {
  rgb: [Number(match[1]), Number(match[2]), Number(match[3])],
  alpha: Number(match[4]),
}

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
const over = (background: readonly number[]) =>
  scrim.rgb.map((value, i) => value * scrim.alpha + background[i] * (1 - scrim.alpha))

describe('welcome curtain contrast', () => {
  for (const [name, background] of [
    ['white map', [255, 255, 255]],
    ['yellow map', [255, 230, 120]],
    ['sky map', [150, 210, 255]],
    ['mid-gray map', [128, 128, 128]],
  ] as const) {
    it(`white text is AA over the scrim on a ${name}`, () => {
      assert.ok(contrast([255, 255, 255], over(background)) >= 4.5)
    })

    it(`the footnote (85% white) is AA over the scrim on a ${name}`, () => {
      const footnote = [255, 255, 255].map((v, i) => v * 0.85 + over(background)[i] * 0.15)
      assert.ok(contrast(footnote, over(background)) >= 4.5)
    })
  }
})
