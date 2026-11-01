import { lazy, Suspense, type ComponentProps } from 'react'

// Editors only, and only once they open it: students never download it.
const ImportWizard = lazy(() => import('./ImportWizard.tsx'))

export const LazyImportWizard = (props: ComponentProps<typeof ImportWizard>) => (
  <Suspense fallback={null}>
    <ImportWizard {...props} />
  </Suspense>
)
