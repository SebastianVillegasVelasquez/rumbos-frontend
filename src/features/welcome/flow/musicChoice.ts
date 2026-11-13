import { es } from '../../../i18n/es.ts'

const text = es.flow.music

export interface MusicChoiceView {
  label: string
  // The state as visible text: the switch never relies on its position alone.
  stateLabel: string
  // The track title, shown next to the disc; null without a track.
  title: string | null
  hint: string
}

// What the music control of the welcome step says. `on` is the audio session
// state (prefs.muted stays the single source of truth); this only words it.
export const musicChoiceView = ({
  on,
  track,
}: {
  on: boolean
  track: { title: string } | null
}): MusicChoiceView => ({
  label: text.label,
  stateLabel: on ? text.on : text.off,
  title: track ? track.title : null,
  hint: text.hint,
})

// The control is offered only when the map has a track, and only on the first
// step: the choice is made once, at the welcome.
export const offersMusicChoice = ({
  hasMusic,
  stepIndex,
}: {
  hasMusic: boolean
  stepIndex: number
}): boolean => hasMusic && stepIndex === 0
