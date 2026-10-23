import { lazy, Suspense, type ComponentProps } from 'react'

// The editor (block forms, image picker, widget textarea) is for teachers
// only: students never download it.
const ContentEditorDialog = lazy(() => import('./ContentEditorDialog.tsx'))

export const LazyContentEditor = (props: ComponentProps<typeof ContentEditorDialog>) => (
  <Suspense fallback={null}>
    <ContentEditorDialog {...props} />
  </Suspense>
)
