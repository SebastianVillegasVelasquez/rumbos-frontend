import { use, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { ScrollMemoryContext } from './scrollMemoryContext.ts'

interface ScrollRegionProps {
  // Names the place whose position is remembered ("appearance:welcome").
  memoryKey: string
  // False while the region is hidden: its position is neither read nor saved.
  active?: boolean
  className?: string
  children: ReactNode
}

// The one place the editor scrolls (vertically only). It remembers where the
// person was per memoryKey and puts them back there when they return: after
// switching sections or tabs, after closing a preview, a dialog or a PDF opened
// in another tab, and after the host's stage changes size. Without this a
// hidden element (display: none) or a re-laid-out one starts again at the top.
export const ScrollRegion = ({
  memoryKey,
  active = true,
  className = '',
  children,
}: ScrollRegionProps) => {
  const memory = use(ScrollMemoryContext)
  const ref = useRef<HTMLDivElement>(null)

  // Coming back to this place (or changing tab): restore.
  useLayoutEffect(() => {
    const el = ref.current
    if (el && active) el.scrollTop = memory.read(memoryKey)
  }, [memory, memoryKey, active])

  useEffect(() => {
    const el = ref.current
    if (!el || !active) return
    const onScroll = () => {
      // A hidden or collapsed box reports 0: that is not the person scrolling.
      if (el.clientHeight === 0) return
      memory.save(memoryKey, el.scrollTop)
    }
    // Something reset the position while the person had not scrolled (the
    // window got focus back, the stage was resized, a preview closed).
    const restore = () => {
      if (el.clientHeight === 0) return
      const saved = memory.read(memoryKey)
      if (saved > 0 && el.scrollTop === 0) el.scrollTop = saved
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') restore()
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('focus', restore)
    window.addEventListener('resize', restore)
    document.addEventListener('visibilitychange', onVisible)
    document.addEventListener('fullscreenchange', restore)
    const observer = new ResizeObserver(restore)
    observer.observe(el)
    return () => {
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('focus', restore)
      window.removeEventListener('resize', restore)
      document.removeEventListener('visibilitychange', onVisible)
      document.removeEventListener('fullscreenchange', restore)
      observer.disconnect()
    }
  }, [memory, memoryKey, active])

  return (
    <div
      ref={ref}
      className={`min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain ${className}`}
    >
      {children}
    </div>
  )
}
