import { findCollisions, type Collision, type Item } from './overlap.ts'

// Development-only (?debug=layout): walks every visible interactive element of
// the app, the HUD and the 3D page inside its iframe, reports the pairs whose
// rectangles intersect to the console and in an on-screen list, and exposes
// window.__layoutReport() for scripted runs. Never part of a production build.

const INTERACTIVE = [
  'button',
  'a[href]',
  'input',
  'select',
  'textarea',
  'summary',
  '[role="button"]',
  '[role="switch"]',
  '[role="tab"]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')
// Anything covering this share of the viewport is a surface (the map), not a control.
const SURFACE_SHARE = 0.4
const PANEL_ID = 'layout-check-panel'

const describe = (el: Element, prefix: string) => {
  const name =
    el.getAttribute('aria-label') ??
    el.getAttribute('title') ??
    el.textContent?.trim().slice(0, 28) ??
    ''
  const id = el.id ? `#${el.id}` : ''
  return `${prefix}${el.tagName.toLowerCase()}${id}${name ? ` "${name}"` : ''}`
}

const pathOf = (el: Element) => {
  const path: number[] = []
  for (let node: Element | null = el; node && node.parentElement; node = node.parentElement) {
    path.unshift([...node.parentElement.children].indexOf(node))
  }
  return path
}

// The part of an element that is really on screen: clipped by the viewport and
// by every ancestor that hides overflow.
const visibleBox = (el: Element, view: Window, origin: { x: number; y: number }) => {
  const rect = el.getBoundingClientRect()
  let box = {
    left: rect.left + origin.x,
    top: rect.top + origin.y,
    right: rect.right + origin.x,
    bottom: rect.bottom + origin.y,
  }
  const clip = (r: { left: number; top: number; right: number; bottom: number }) => {
    box = {
      left: Math.max(box.left, r.left + origin.x),
      top: Math.max(box.top, r.top + origin.y),
      right: Math.min(box.right, r.right + origin.x),
      bottom: Math.min(box.bottom, r.bottom + origin.y),
    }
  }
  for (let parent = el.parentElement; parent; parent = parent.parentElement) {
    const overflow = view.getComputedStyle(parent).overflow
    if (overflow !== 'visible') clip(parent.getBoundingClientRect())
  }
  clip({ left: 0, top: 0, right: view.innerWidth, bottom: view.innerHeight })
  return box.right - box.left > 1 && box.bottom - box.top > 1 ? box : null
}

const isShown = (el: Element, view: Window) => {
  for (let node: Element | null = el; node; node = node.parentElement) {
    const style = view.getComputedStyle(node)
    if (style.display === 'none' || style.visibility === 'hidden') return false
    if (node.hasAttribute('hidden') || node.hasAttribute('data-layout-check')) return false
  }
  return true
}

// Modal dialogs and popovers are layers of their own.
const layerOf = (el: Element) => {
  const layer = el.closest(
    '[aria-modal="true"], [data-radix-popper-content-wrapper], [role="alertdialog"]'
  )
  return layer ? `layer:${pathOf(layer).join('.')}` : 'page'
}

const collect = (
  doc: Document,
  origin: { x: number; y: number },
  prefix: string,
  items: Item[],
  salt: number
) => {
  const view = doc.defaultView
  if (!view) return
  for (const el of doc.querySelectorAll(INTERACTIVE)) {
    // The map is a focusable image the controls float on, not a control.
    if (el.matches('[role="img"]') || !isShown(el, view)) continue
    const box = visibleBox(el, view, origin)
    if (!box) continue
    // The map itself (a focusable surface the controls float on) is not a control.
    const area = (box.right - box.left) * (box.bottom - box.top)
    if (area > SURFACE_SHARE * view.innerWidth * view.innerHeight) continue
    items.push({
      label: describe(el, prefix),
      box,
      // The 3D page shares the app's layers: its controls are compared with the HUD.
      layer: layerOf(el),
      path: [salt, ...pathOf(el)],
    })
  }
}

export const runLayoutCheck = (): Collision[] => {
  const items: Item[] = []
  collect(document, { x: 0, y: 0 }, '', items, 0)
  document.querySelectorAll('iframe').forEach((frame, index) => {
    let inner: Document | null = null
    try {
      inner = frame.contentDocument
    } catch {
      // Cross-origin (a video): nothing of ours to measure inside.
    }
    if (!inner || !isShown(frame, window)) return
    const rect = frame.getBoundingClientRect()
    collect(inner, { x: rect.left, y: rect.top }, '3d:', items, index + 1)
  })
  ;(window as unknown as { __layoutItems: number }).__layoutItems = items.length
  return findCollisions(items)
}

const render = (collisions: Collision[]) => {
  let panel = document.getElementById(PANEL_ID)
  if (!panel) {
    panel = document.createElement('div')
    panel.id = PANEL_ID
    panel.setAttribute('data-layout-check', '')
    panel.style.cssText =
      'position:fixed;left:8px;top:8px;z-index:99999;max-width:min(420px,70vw);max-height:40vh;overflow:auto;' +
      'font:11px/1.35 monospace;background:#fff;color:#111;border:2px solid #b3261e;padding:6px 8px;pointer-events:none;white-space:pre-wrap;'
    document.body.appendChild(panel)
  }
  panel.style.borderColor = collisions.length ? '#b3261e' : '#146b3f'
  panel.textContent =
    collisions.length === 0
      ? 'layout: no overlaps'
      : `layout: ${collisions.length} overlap(s)\n` +
        collisions.map((c) => `${c.a}  X  ${c.b}  (${c.width}x${c.height})`).join('\n')
}

export const startLayoutCheck = () => {
  let timer = 0
  let last = ''
  const check = () => {
    const collisions = runLayoutCheck()
    const key = JSON.stringify(collisions)
    if (key !== last) {
      last = key
      if (collisions.length) console.warn('[layout] overlaps', collisions)
      else console.info('[layout] no overlaps')
    }
    render(collisions)
  }
  const schedule = () => {
    window.clearTimeout(timer)
    timer = window.setTimeout(check, 300)
  }
  // The report panel changes the DOM too; ignore its own mutations.
  new MutationObserver((records) => {
    if (records.every((record) => (record.target as Element).closest?.('[data-layout-check]')))
      return
    schedule()
  }).observe(document.body, { subtree: true, childList: true, attributes: true })
  window.addEventListener('resize', schedule)
  window.setInterval(schedule, 1500)
  ;(window as unknown as { __layoutReport: () => Collision[] }).__layoutReport = runLayoutCheck
  schedule()
}
