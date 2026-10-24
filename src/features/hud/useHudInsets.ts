import { useEffect, type RefObject } from 'react'
import { cameraBridge, NO_INSETS } from '../view3d/cameraBridge.ts'
import { computeInsets, type HudEdge } from './insets.ts'

const EDGES: readonly string[] = ['top', 'right', 'bottom', 'left']

// Measures what the HUD covers (every element marked data-hud-edge) and hands
// it to the 3D bridge, which tells the page where it may draw. A
// ResizeObserver watches the stage and each marked element; the bridge
// debounces what it sends.
export const useHudInsets = (stageRef: RefObject<HTMLElement | null>, enabled: boolean) => {
  useEffect(() => {
    const stage = stageRef.current
    if (!enabled || !stage) return
    const observer = new ResizeObserver(() => measure())
    const watched = new Set<Element>()

    const measure = () => {
      const marked = [...stage.querySelectorAll('[data-hud-edge]')]
      for (const element of marked) {
        if (!watched.has(element)) {
          watched.add(element)
          observer.observe(element)
        }
      }
      const items = marked.flatMap((element) => {
        const edge = element.getAttribute('data-hud-edge') ?? ''
        return EDGES.includes(edge)
          ? [{ edge: edge as HudEdge, box: element.getBoundingClientRect() }]
          : []
      })
      cameraBridge.setInsets(computeInsets(stage.getBoundingClientRect(), items))
    }

    observer.observe(stage)
    // Controls come and go with state (Misiones, Continuar), without resizing the stage.
    const mutations = new MutationObserver(measure)
    mutations.observe(stage, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-hud-edge', 'style'],
    })
    measure()
    return () => {
      observer.disconnect()
      mutations.disconnect()
      cameraBridge.setInsets(NO_INSETS)
    }
  }, [stageRef, enabled])
}
