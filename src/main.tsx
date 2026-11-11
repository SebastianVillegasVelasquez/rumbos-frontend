import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import Root from './Root.tsx'

// Window-focus refetches would reload the map while the user is mid-drag.
const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
})

// ?debug=layout: report overlapping controls (development builds only).
if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('debug') === 'layout') {
  void import('./dev/layoutCheck.ts').then((module) => module.startLayoutCheck())
}

// ?diag=1: a read-only panel with what a viewer's screenshot needs (production
// too). Loaded lazily; the listeners below only remember the last uncaught
// error in memory, so the panel can show it. Nothing is sent anywhere.
if (new URLSearchParams(window.location.search).get('diag') === '1') {
  const remember = (message: unknown) => {
    window.__rumbosDiagError = String(message).slice(0, 300)
  }
  window.addEventListener('error', (event) => remember(event.message))
  window.addEventListener('unhandledrejection', (event) => remember(event.reason))
  void import('./diag/startDiag.tsx').then((module) => module.startDiag())
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Root />
    </QueryClientProvider>
  </StrictMode>
)
