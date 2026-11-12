import { useId } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { es } from '../../i18n/es.ts'
import { NowPlayingDisc } from '../audio/NowPlayingDisc.tsx'
import { coverToLoad } from '../audio/nowPlaying.ts'

const text = es.welcome

// The curtain's one music control: the track's disc, its title and the on/off
// state are a single switch, so nothing that looks tappable here does nothing.
// A native button: Space and Enter work, and `aria-checked` is what a screen
// reader announces. It only reports the click; the audio session decides.
export const CurtainMusicSwitch = ({
  on,
  disabled,
  track,
  dataSaver,
  onToggle,
}: {
  on: boolean
  disabled: boolean
  track: { title: string; coverUrl: string | null } | null
  dataSaver: boolean
  onToggle: () => void
}) => {
  const titleId = useId()
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={text.musicLabel}
      aria-describedby={track ? titleId : undefined}
      disabled={disabled}
      onClick={onToggle}
      className="flex min-h-[44px] max-w-full items-center gap-3 rounded-pill border border-white/60 py-1 pr-4 text-sm font-bold disabled:opacity-60"
      style={{ paddingLeft: track ? '0.25rem' : '1rem' }}
    >
      {track && (
        <span
          aria-hidden
          className="block h-9 w-9 shrink-0 overflow-hidden rounded-pill border border-white/60"
        >
          <NowPlayingDisc
            cover={coverToLoad({
              coverUrl: track.coverUrl,
              dataSaver,
              startedOnce: true,
              failed: false,
            })}
            state={{ spinning: false, muted: !on, badge: on ? 'playing' : 'muted' }}
          />
        </span>
      )}
      <span className="flex min-w-0 flex-col items-start text-left leading-tight">
        <span className="flex items-center gap-1.5">
          {on ? (
            <Volume2 size={16} strokeWidth={2.5} aria-hidden />
          ) : (
            <VolumeX size={16} strokeWidth={2.5} aria-hidden />
          )}
          {on ? text.musicOn : text.musicOff}
        </span>
        {track && (
          <span id={titleId} className="max-w-full truncate text-xs font-semibold text-white/85">
            {track.title}
          </span>
        )}
      </span>
    </button>
  )
}
