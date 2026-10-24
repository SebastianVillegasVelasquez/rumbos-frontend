import { Suspense, lazy, type ComponentProps } from 'react'

// The curtain, its sparkles and the video code stay out of the initial bundle;
// they load only when a curtain is going to show. Until then the stage shows a
// plain backdrop, so the map never flashes before the curtain.
const WelcomeCurtain = lazy(() => import('./WelcomeCurtain.tsx'))

export const LazyWelcomeCurtain = (props: ComponentProps<typeof WelcomeCurtain>) => (
  <Suspense fallback={<div className="absolute inset-0 z-50 bg-ink" />}>
    <WelcomeCurtain {...props} />
  </Suspense>
)
