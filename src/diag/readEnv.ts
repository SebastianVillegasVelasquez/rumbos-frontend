import type { DiagEnv } from './diagSnapshot.ts'

declare global {
  interface Window {
    // Filled by the tiny listener main.tsx installs when ?diag=1 is present.
    __rumbosDiagError?: string
  }
}

const supports = (property: string, value: string) =>
  typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports(property, value)

// Reads what the page already knows. Measures the DOM; touches nothing.
export const readEnv = (): DiagEnv => {
  const dialog = document.querySelector<HTMLElement>('[role="dialog"][data-video-load]')
  const frame = dialog?.querySelector('iframe') ?? null
  const panel = document.querySelector('.video-panel') ?? frame?.parentElement ?? null
  const parentOf = (element: Element | null) => {
    let parent = element?.parentElement ?? null
    while (parent && getComputedStyle(parent).display === 'contents') parent = parent.parentElement
    return parent
  }
  const parent = parentOf(panel)
  const box = (element: Element | null) => {
    const rect = element?.getBoundingClientRect()
    return rect ? { width: rect.width, height: rect.height } : null
  }
  return {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    embedded: window.parent !== window,
    userAgent: navigator.userAgent,
    supports: {
      aspectRatio: supports('aspect-ratio', '1'),
      dvh: supports('height', '1dvh'),
      containerQueries: supports('container-type', 'inline-size'),
      has: typeof CSS !== 'undefined' && CSS.supports?.('selector(:has(*))') === true,
    },
    panel: box(panel),
    panelParent: parent
      ? {
          height: parent.getBoundingClientRect().height,
          computedHeight: getComputedStyle(parent).height,
        }
      : null,
    videoFrame: box(frame),
    videoLoad: dialog?.dataset.videoLoad ?? null,
    lastError: window.__rumbosDiagError ?? null,
  }
}
