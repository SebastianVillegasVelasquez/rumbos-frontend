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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Root />
    </QueryClientProvider>
  </StrictMode>
)
