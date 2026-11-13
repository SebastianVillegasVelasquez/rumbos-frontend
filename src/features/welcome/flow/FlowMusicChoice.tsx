import { useId } from 'react'
import { Music2 } from 'lucide-react'
import { NowPlayingDisc } from '../../audio/NowPlayingDisc.tsx'
import { coverToLoad } from '../../audio/nowPlaying.ts'
import { musicChoiceView } from './musicChoice.ts'

// The music control of the welcome step: a labeled switch with the track disc and
// title, its state in words and one line saying it can be changed later. A native
// button with role="switch": Space and Enter work and `aria-checked` is announced.
// It only reports the click; the audio session decides (prefs.muted stays the
// single source of truth).
export const FlowMusicChoice = ({
  on,
  track,
  dataSaver,
  onToggle,
}: {
  on: boolean
  track: { title: string; coverUrl: string | null } | null
  dataSaver: boolean
  onToggle: () => void
}) => {
  const view = musicChoiceView({ on, track })
  const detailId = useId()
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={view.label}
      aria-describedby={detailId}
      onClick={onToggle}
      className="flow-music border-soft"
    >
      <span aria-hidden className="flow-music-disc">
        {track ? (
          <NowPlayingDisc
            cover={coverToLoad({
              coverUrl: track.coverUrl,
              dataSaver,
              startedOnce: true,
              failed: false,
            })}
            state={{ spinning: false, muted: !on, badge: on ? 'playing' : 'muted' }}
          />
        ) : (
          <Music2 size={22} strokeWidth={2.5} />
        )}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-base font-extrabold">{view.label}</span>
        <span id={detailId} className="block text-sm text-ink-soft">
          {view.title && <span className="block truncate font-bold text-ink">{view.title}</span>}
          {view.hint}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-center gap-1">
        <span aria-hidden className="flow-switch" data-on={on}>
          <span />
        </span>
        <span aria-hidden className="text-xs font-extrabold">
          {view.stateLabel}
        </span>
      </span>
    </button>
  )
}
