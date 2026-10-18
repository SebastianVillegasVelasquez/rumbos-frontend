import { Suspense, lazy } from 'react'
import App from './App.tsx'

// The embedded build of the app (the Moodle iframe) lives behind its own lazy
// chunk, so the standalone bundle does not carry the handshake and host code.
const EmbedRoot = lazy(() => import('./features/embed/EmbedRoot.tsx'))

const isEmbedRoute = /\/embed\/?$/.test(window.location.pathname)

const Root = () =>
  isEmbedRoute ? (
    <Suspense fallback={null}>
      <EmbedRoot />
    </Suspense>
  ) : (
    <App />
  )

export default Root
