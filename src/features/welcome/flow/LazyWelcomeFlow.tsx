import { Suspense, lazy, type ComponentProps } from 'react'

// The player, its steps and the video code stay out of the initial bundle; they
// load only when a flow is going to show. Until then the stage shows a plain
// backdrop, so the map never flashes before the flow.
const WelcomeFlow = lazy(() => import('./WelcomeFlow.tsx'))

export const LazyWelcomeFlow = (props: ComponentProps<typeof WelcomeFlow>) => (
  <Suspense fallback={<div className="absolute inset-0 z-50 bg-ink" />}>
    <WelcomeFlow {...props} />
  </Suspense>
)
