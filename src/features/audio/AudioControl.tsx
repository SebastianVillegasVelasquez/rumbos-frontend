import { useEffect, useState, useSyncExternalStore } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { Button, IconButton } from '../../components/ui/Button.tsx'
import { Popover } from '../../components/ui/Popover.tsx'
import { es } from '../../i18n/es.ts'
import { audioSession, type AudioTrack } from './audioSession.ts'
import { effectiveVolume } from './audioPrefs.ts'
import { wantsMusic } from './audioState.ts'

// The student's music control, for the bottom-right cluster: a button that opens
// a small popover with the on/off switch, the volume and the credit. This is the
// control that lets anyone stop the audio or change its volume on their own, as
// WCAG requires for sound longer than three seconds.
const AudioControl = ({ track }: { track: AudioTrack }) => {
  const [open, setOpen] = useState(false)
  const view = useSyncExternalStore(audioSession.subscribe, audioSession.getView)

  // The stage is on screen: the music may play. Leaving it pauses (and keeps
  // what the viewer wanted).
  useEffect(() => {
    audioSession.setActive(true)
    return () => audioSession.setActive(false)
  }, [])
  useEffect(() => {
    audioSession.setTrack(track)
  }, [track])

  const wants = wantsMusic(view.state)
  const volume = Math.round(effectiveVolume(view.prefs, track.volume) * 100)
  const label = wants ? es.audio.buttonOn : es.audio.buttonOff

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="end"
      trigger={
        <IconButton
          variant="surface"
          className="hud-dimmable pointer-events-auto"
          aria-label={label}
          title={label}
        >
          {wants && !view.state.failed ? (
            <Volume2 size={18} strokeWidth={2.5} aria-hidden />
          ) : (
            <VolumeX size={18} strokeWidth={2.5} aria-hidden />
          )}
        </IconButton>
      }
    >
      <div className="w-64 space-y-3">
        <h2 className="font-heading text-base font-extrabold text-ink">{es.audio.title}</h2>
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
        {view.state.failed && (
          <p role="alert" className="text-xs font-bold text-danger">
            {es.audio.failed}
          </p>
        )}
        <p className="text-xs font-semibold text-ink-soft">
          {es.audio.credit(track.title, track.credit)}
        </p>
      </div>
    </Popover>
  )
}

export default AudioControl
