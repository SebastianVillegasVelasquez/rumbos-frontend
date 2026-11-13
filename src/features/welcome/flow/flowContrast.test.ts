import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

// WCAG contrast of the welcome flow, computed from the design tokens (not by eye):
// the title, the body, the status line, the disabled "waiting" button and the
// progress bar, on the card and on the dark stage. Text needs 4.5:1 (3:1 for
// large text); the shapes of the progress bar and the card edge need 3:1.

const tokens = readFileSync(new URL('../../../styles/tokens.css', import.meta.url), 'utf8')

const color = (name: string): number[] => {
  const match = tokens.match(new RegExp(`--color-${name}:\\s*#([0-9a-fA-F]{6})`))
  assert.ok(match, `token --color-${name} is missing`)
  const hex = match[1]
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16))
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

const ink = color('ink')
const inkSoft = color('ink-soft')
const surface = color('surface')
const muted = color('surface-muted')
const primary = color('primary')
const accent = color('accent')
const sunDark = color('sun-dark')
const sunTint = color('sun-tint')

// The lightest the stage gets: the first (lightest) alpha of the overlay over a
// white map. The card's white edge is measured against it.
const overlay = tokens.match(
  /--flow-stage-overlay:\s*linear-gradient\(\s*to bottom,\s*rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)/
)
assert.ok(overlay, 'the stage overlay token is missing')
const lightestStage = [Number(overlay[1]), Number(overlay[2]), Number(overlay[3])].map(
  (value) => value * Number(overlay[4]) + 255 * (1 - Number(overlay[4]))
)

// The track of the segments not done: surface mixed into ink by the percentage in
// welcome-flow.css, against the header (ink) it sits on.
const css = readFileSync(new URL('../../../styles/welcome-flow.css', import.meta.url), 'utf8')
const mix = css.match(
  /--flow-track:\s*color-mix\(in srgb,\s*var\(--color-surface\)\s*(\d+)%,\s*var\(--color-ink\)\)/
)
assert.ok(mix, 'the progress track token is missing')
const track = ink.map((value, i) =>
  Math.round(value + (surface[i] - value) * (Number(mix[1]) / 100))
)

const TEXT = 4.5
const SHAPE = 3

const cases: Array<[string, readonly number[], readonly number[], number]> = [
  ['title and body: ink on the card', ink, surface, TEXT],
  ['status line and hints: ink-soft on the footer', inkSoft, muted, TEXT],
  ['hints on the card body: ink-soft on surface', inkSoft, surface, TEXT],
  ['music card hint: ink-soft on its muted surface', inkSoft, muted, TEXT],
  ['eyebrow: primary on the card', primary, surface, TEXT],
  ['disabled "waiting" button: sun-dark on sun-tint', sunDark, sunTint, TEXT],
  ['review and preview note: sun-dark on sun-tint', sunDark, sunTint, TEXT],
  ['step line on the header: white on ink', surface, ink, TEXT],
  ['progress, current segment: white on the header', surface, ink, SHAPE],
  ['progress, done segment: yellow on the header', accent, ink, SHAPE],
  ['progress, upcoming track: mixed white on the header', track, ink, SHAPE],
  ['progress, current segment on the track', surface, track, 1.5],
  ['primary button: ink on yellow', ink, accent, TEXT],
  ['the card edge against the lightest stage', surface, lightestStage, SHAPE],
]

describe('welcome flow contrast', () => {
  for (const [name, foreground, background, minimum] of cases) {
    it(`${name} is at least ${minimum}:1`, () => {
      const ratio = contrast(foreground, background)
      assert.ok(ratio >= minimum, `${name}: ${ratio.toFixed(2)}:1`)
      if (process.env.SHOW_CONTRAST) console.log(`${ratio.toFixed(2)}:1  ${name}`)
    })
  }
})
