import { lazy, Suspense } from 'react'
import type { Content } from './contentTypes.ts'

// Only students who open a content bubble pay for the viewer.
const ContentViewer = lazy(() => import('./ContentViewer.tsx'))

export const LazyContentViewer = (props: {
  content: Content | null
  widgetsEnabled: boolean
  onClose: () => void
}) =>
  props.content ? (
    <Suspense fallback={null}>
      <ContentViewer {...props} />
    </Suspense>
  ) : null
