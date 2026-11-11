import { useLayoutEffect, useState, type RefObject } from 'react'
import { fitVideoPanel } from './videoPanelFit.ts'

const contentWidth = (element: HTMLElement) => {
  const style = getComputedStyle(element)
  return element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
}

// Measures `view` (the scrolling box) and `column` (the box the panel sits in)
// and returns the panel's width in px, or null until there is a real
// measurement. Follows window resizes and host fullscreen changes, which both
// resize the boxes.
export const useVideoPanelWidth = (
  view: RefObject<HTMLElement | null>,
  column: RefObject<HTMLElement | null>,
  active: boolean
): number | null => {
  const [width, setWidth] = useState<number | null>(null)
  useLayoutEffect(() => {
    const viewEl = view.current
    const columnEl = column.current
    if (!active || !viewEl || !columnEl) return
    const measure = () => {
      const size = fitVideoPanel({
        availWidth: contentWidth(columnEl),
        availHeight: viewEl.clientHeight,
      })
      setWidth(size ? size.width : null)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(viewEl)
    observer.observe(columnEl)
    return () => observer.disconnect()
  }, [view, column, active])
  return active ? width : null
}
