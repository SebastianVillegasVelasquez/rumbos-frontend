import { lazy, Suspense, type ComponentProps } from 'react'

// Teachers only, and only while the heat map is on: students never download it.
const HeatmapPanel = lazy(() => import('./HeatmapPanel.tsx'))

export const LazyHeatmapPanel = (props: ComponentProps<typeof HeatmapPanel>) => (
  <Suspense fallback={null}>
    <HeatmapPanel {...props} />
  </Suspense>
)
