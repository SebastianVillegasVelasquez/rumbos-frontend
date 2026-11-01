import { lazy, Suspense, type ComponentProps } from 'react'

// Editors only, and only once they open it: students never download it.
const ExportDialog = lazy(() => import('./ExportDialog.tsx'))

export const LazyExportDialog = (props: ComponentProps<typeof ExportDialog>) => (
  <Suspense fallback={null}>
    <ExportDialog {...props} />
  </Suspense>
)
