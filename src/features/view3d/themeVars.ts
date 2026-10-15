import { useSyncExternalStore } from 'react'
import type { CssVars } from './protocol.ts'

// Host design token -> the --r3d-* property the 3D page reads (see world.css).
// Values are read from the computed style of <html>, so a client theme
// ([data-theme]) flows through without this file knowing about it.
const TOKEN_MAP: ReadonlyArray<readonly [host: string, page: string]> = [
  ['--color-ink', '--r3d-ink'],
  ['--color-ink-soft', '--r3d-ink-soft'],
  ['--color-paper', '--r3d-paper'],
  ['--color-surface', '--r3d-surface'],
  ['--color-primary', '--r3d-primary'],
  ['--color-primary-tint', '--r3d-tint'],
  ['--color-accent', '--r3d-accent'],
  ['--color-sun-dark', '--r3d-accent-strong'],
  ['--radius-sm', '--r3d-radius-md'],
  ['--radius-md', '--r3d-radius-lg'],
  ['--font-body', '--r3d-font-sans'],
  ['--font-heading', '--r3d-font-heading'],
]

// Web fonts of the host are not available inside the iframe (it loads none of
// the app's CSS), so these stacks fall back to the system font there.
export const readHostTheme = (root: HTMLElement = document.documentElement): CssVars => {
  const style = getComputedStyle(root)
  const vars: CssVars = {}
  for (const [host, page] of TOKEN_MAP) {
    const value = style.getPropertyValue(host).trim()
    if (value) vars[page] = value
  }
  const primary = vars['--r3d-primary']
  if (primary) {
    vars['--r3d-primary-hover'] = `color-mix(in srgb, ${primary} 85%, black)`
  }
  vars['--r3d-on-primary'] = '#ffffff'
  const ink = vars['--r3d-ink']
  const surface = vars['--r3d-surface']
  if (ink && surface) vars['--r3d-border'] = `color-mix(in srgb, ${ink} 18%, ${surface})`
  return vars
}

// The snapshot must be referentially stable between changes for
// useSyncExternalStore, so it is cached by its serialization.
let cached: { key: string; vars: CssVars } | null = null
const snapshot = (): CssVars => {
  const vars = readHostTheme()
  const key = JSON.stringify(vars)
  if (cached?.key !== key) cached = { key, vars }
  return cached.vars
}

const subscribe = (notify: () => void) => {
  // A client theme is switched with data-theme on <html>.
  const observer = new MutationObserver(notify)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'class', 'style'],
  })
  return () => observer.disconnect()
}

export const useHostTheme3d = (): CssVars => useSyncExternalStore(subscribe, snapshot)
