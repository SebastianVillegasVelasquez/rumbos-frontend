import { createRoot } from 'react-dom/client'
import DiagPanel from './DiagPanel.tsx'

// ?diag=1: mounts the panel in a root of its own, next to the app's, so
// nothing in the app's tree changes.
export const startDiag = () => {
  const host = document.createElement('div')
  host.id = 'rumbos-diag'
  document.body.append(host)
  createRoot(host).render(<DiagPanel />)
}
