import { Suspense, lazy, type ComponentProps } from 'react'

// The whole trainer (its screens, its runners, its copy) stays out of the embed's
// first download and loads when a student presses "Entrenar".
const TrainerStage = lazy(() => import('./TrainerStage.tsx'))

export const LazyTrainerStage = (props: ComponentProps<typeof TrainerStage>) => (
  <Suspense fallback={<div className="absolute inset-0 z-40 bg-ink" />}>
    <TrainerStage {...props} />
  </Suspense>
)
