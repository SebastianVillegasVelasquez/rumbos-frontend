import { useState } from 'react'
import { Music2, Pause, VolumeX } from 'lucide-react'
import type { DiscState } from './nowPlaying.ts'

// The picture of a record: the cover cropped to a circle, or a procedural vinyl
// when there is none (or it failed to load). Purely presentational and
// decorative: the control that wraps it carries the name and the state.
//
// Only the image layer rotates; the dim and the badges stay still, and the
// wrapping button (with its focus ring) never moves.
const Vinyl = () => (
  <svg viewBox="0 0 100 100" className="block h-full w-full" aria-hidden focusable="false">
    <circle cx="50" cy="50" r="50" fill="var(--color-ink)" />
    <circle cx="50" cy="50" r="42" fill="none" stroke="var(--color-ink-soft)" strokeWidth="1.5" />
    <circle cx="50" cy="50" r="33" fill="none" stroke="var(--color-ink-soft)" strokeWidth="1.5" />
    <circle cx="50" cy="50" r="24" fill="var(--color-primary)" />
  </svg>
)

export const NowPlayingDisc = ({
  cover,
  state,
}: {
  // Already gated by coverToLoad: null means the procedural disc.
  cover: string | null
  state: DiscState
}) => {
  // A failed image falls back silently, for as long as this URL is the one asked.
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null)
  const showImage = cover !== null && failedUrl !== cover
  const loaded = showImage && loadedUrl === cover

  return (
    <span aria-hidden className="relative block h-full w-full overflow-hidden rounded-pill">
      <span className="disc-spin block h-full w-full" data-spinning={state.spinning}>
        <Vinyl />
        {showImage && (
          <img
            src={cover}
            alt=""
            draggable={false}
            decoding="async"
            onLoad={() => setLoadedUrl(cover)}
            onError={() => setFailedUrl(cover)}
            className={`absolute inset-0 h-full w-full rounded-pill object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          />
        )}
        {!loaded && (
          <Music2
            size={16}
            strokeWidth={2.5}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white"
          />
        )}
      </span>
      {state.muted && (
        <span className="absolute inset-0 flex items-center justify-center bg-ink/60 text-white">
          <VolumeX size={20} strokeWidth={2.5} />
        </span>
      )}
      {state.badge === 'paused' && (
        <span className="absolute inset-0 flex items-center justify-center bg-ink/35 text-white">
          <Pause size={16} strokeWidth={3} />
        </span>
      )}
    </span>
  )
}
