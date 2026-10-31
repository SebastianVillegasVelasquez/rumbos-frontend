import { useCallback, useEffect, useMemo } from 'react'
import { useHostStats } from '../embed/hostStats.ts'
import { createStatsController } from './statsController.ts'

// Owns the heat map's request cycle while it is mounted. Mounting it asks the
// host for counts; unmounting (the toggle went off) or leaving the page drops
// them, so nothing outlives the view that shows them.
export const useHeatmap = (requestStats: (groupId?: number) => void) => {
  const controller = useMemo(
    () =>
      createStatsController({
        send: requestStats,
        schedule: (run, delayMs) => {
          const timer = window.setTimeout(run, delayMs)
          return () => window.clearTimeout(timer)
        },
      }),
    [requestStats]
  )

  useEffect(() => {
    controller.request()
    const onPageHide = () => controller.stop()
    window.addEventListener('pagehide', onPageHide)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      controller.stop()
    }
  }, [controller])

  return {
    state: useHostStats(),
    refresh: useCallback(() => controller.refresh(), [controller]),
    selectGroup: useCallback((groupId?: number) => controller.request(groupId), [controller]),
  }
}
