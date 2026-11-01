import { useEffect, useId, useState, useSyncExternalStore } from 'react'
import { Button } from '../../components/ui/Button.tsx'
import { Popover } from '../../components/ui/Popover.tsx'
import { useDataSaver } from '../../fx/dataSaverStore.ts'
import { es } from '../../i18n/es.ts'
import { audioSession, type AudioTrack } from './audioSession.ts'
import { effectiveVolume } from './audioPrefs.ts'
import { audioControlMode } from './audioAvailability.ts'
import { wantsMusic } from './audioState.ts'
import { NowPlayingDisc } from './NowPlayingDisc.tsx'
import { coverToLoad, discState, trackDescription } from './nowPlaying.ts'

const text = es.audio.nowPlaying

// The student's music control, for the bottom-right cluster: the spinning disc of
// the track that plays. Pressing it opens a small popover with the on/off switch,
// the volume and the complete title, credit and license. This is the control that
// lets anyone stop the audio or change its volume on their own, as WCAG requires
// for sound longer than three seconds.
const AudioControl = ({
  track,
  diagnostics = false,
}: {
  track: AudioTrack
  // Editors and the preview are told when the file cannot be played; students
  // are not.
  diagnostics?: boolean
}) => {
  const [open, setOpen] = useState(false)
  // The track whose music has begun at least once: the cover loads only then.
  const [startedFor, setStartedFor] = useState<string | null>(null)
  const view = useSyncExternalStore(audioSession.subscribe, audioSession.getView)
  const dataSaver = useDataSaver().active
  const descriptionId = useId()

  // The stage is on screen: the music may play. Leaving it pauses (and keeps
  // what the viewer wanted).
  useEffect(() => {
    audioSession.setActive(true)
    return () => audioSession.setActive(false)
  }, [])
  useEffect(() => {
    audioSession.setTrack(track)
  }, [track])

  if (view.playing && view.track?.assetId === track.assetId && startedFor !== track.assetId) {
    setStartedFor(track.assetId)
  }

  const wants = wantsMusic(view.state)
  const volume = Math.round(effectiveVolume(view.prefs, track.volume) * 100)
  const mode = audioControlMode({ failed: view.state.failed, diagnostics })

  // The hooks above keep running so the session stays in step with the stage;
  // for a student a failed track just leaves no control behind.
  if (mode === 'hidden') return null

  const title = track.title.trim() || text.untitled
  const state = discState({ playing: view.playing, wants: wants && !view.state.failed })
  const details = trackDescription({ title, credit: track.credit, license: track.license })
  const cover = coverToLoad({
    coverUrl: track.coverUrl,
    dataSaver,
    startedOnce: startedFor === track.assetId,
    failed: false,
  })
  const name = text.buttonName(title)

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="end"
      trigger={
        <button
          type="button"
          className="hud-dimmable border-soft pointer-events-auto relative h-11 w-11 min-w-[44px] shrink-0 rounded-pill bg-surface p-0"
          aria-label={name}
          aria-describedby={descriptionId}
          title={name}
        >
          <NowPlayingDisc key={track.assetId} cover={cover} state={state} />
          <span id={descriptionId} className="sr-only">
            {text.withState(text.stateLabel[state.badge], details || es.audio.title)}
          </span>
        </button>
      }
    >
      <div className="w-64 space-y-3">
        <h2 className="font-heading text-base font-extrabold text-ink">{es.audio.title}</h2>
        <dl className="space-y-1 text-sm text-ink">
          <div>
            <dt className="sr-only">{text.titleLabel}</dt>
            <dd className="break-words font-extrabold">{title}</dd>
          </div>
          {track.credit.trim() && (
            <div>
              <dt className="sr-only">{text.creditLabel}</dt>
              <dd className="break-words font-semibold text-ink-soft">{track.credit.trim()}</dd>
            </div>
          )}
          {track.license && (
            <div>
              <dt className="text-xs font-bold text-ink-soft">{text.licenseLabel}</dt>
              <dd className="break-words text-xs font-semibold text-ink-soft">{track.license}</dd>
            </div>
          )}
        </dl>
        <Button
          variant="surface"
          dense
          size="sm"
          className="w-full"
          role="switch"
          aria-checked={wants}
          onClick={audioSession.toggle}
        >
          {wants ? es.audio.turnOff : es.audio.turnOn}
        </Button>
        <label className="block text-sm font-bold text-ink">
          {es.audio.volume}
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={volume}
            onChange={(event) => audioSession.setVolume(Number(event.target.value) / 100)}
            className="mt-1 h-11 w-full accent-primary"
          />
        </label>
        {mode === 'warning' && (
          <p role="alert" className="text-xs font-bold text-danger">
            {es.audio.unavailableWarning}
          </p>
        )}
      </div>
    </Popover>
  )
}

export default AudioControl
