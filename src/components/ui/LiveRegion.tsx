import { useAnnouncement } from './announce.ts'

// Mounted once near the root. The key restarts the text node so the same
// message announced twice in a row is read twice.
export const LiveRegion = () => {
  const { id, message } = useAnnouncement()
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      <span key={id}>{message}</span>
    </div>
  )
}
