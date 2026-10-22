import { useEffect, useState, type RefObject } from 'react'

// The size of the element the HUD is laid out in (not the window: the app can
// sit in an iframe of any height).
export const useStageSize = (ref: RefObject<HTMLElement | null>) => {
  const [size, setSize] = useState({ width: 360, height: 640 })
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize((previous) =>
        previous.width === width && previous.height === height ? previous : { width, height }
      )
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return size
}
