// What the now-playing disc shows, as pure functions so the whole state matrix
// is tested without a browser. The disc is a view of the audio session: it adds
// no playback state of its own.

export type DiscBadge = 'playing' | 'paused' | 'muted'

export interface DiscState {
  // The image layer turns only while the music is audible.
  spinning: boolean
  // The viewer switched the music off: the disc dims and shows a speaker-off.
  muted: boolean
  // The state as a shape, so it is never conveyed by motion alone.
  badge: DiscBadge
}

export const discState = ({ playing, wants }: { playing: boolean; wants: boolean }): DiscState => {
  if (!wants) return { spinning: false, muted: true, badge: 'muted' }
  if (!playing) return { spinning: false, muted: false, badge: 'paused' }
  return { spinning: true, muted: false, badge: 'playing' }
}

// The cover to put in the <img>, or null for the procedural disc. Under data
// saver the cover is never fetched; otherwise it waits for the music to start
// once, and a cover that failed to load is not retried.
export const coverToLoad = ({
  coverUrl,
  dataSaver,
  startedOnce,
  failed,
}: {
  coverUrl: string | null
  dataSaver: boolean
  startedOnce: boolean
  failed: boolean
}): string | null => (coverUrl && !dataSaver && startedOnce && !failed ? coverUrl : null)

export interface TrackText {
  title: string
  credit: string
  license: string | null
}

const clean = (value: string | null | undefined) => value?.trim() ?? ''

// The credit and license as the button's description; empty when there is none.
export const trackDescription = (track: TrackText): string =>
  [clean(track.credit), clean(track.license)].filter(Boolean).join(' · ')

// ---- The pill ---------------------------------------------------------------------

// How long the pill stays after the track starts (or a tap).
export const PILL_MS = 6000

// The ladder that keeps the pill clear of the other controls, from most to least
// text: three lines (title, credit, license), two (title; "credit · license"),
// one (title only; the rest is in the popover).
export type PillLevel = 3 | 2 | 1

const MIN_ROOM_THREE = 200
const MIN_ROOM_TWO = 140

export const pillLevelForRoom = (room: number): PillLevel =>
  room >= MIN_ROOM_THREE ? 3 : room >= MIN_ROOM_TWO ? 2 : 1

export interface PillLine {
  key: 'title' | 'credit' | 'license' | 'creditLicense'
  text: string
}

// The lines for a level; a missing credit or license simply has no line.
export const pillLines = (track: TrackText, level: PillLevel): PillLine[] => {
  const title = clean(track.title)
  const credit = clean(track.credit)
  const license = clean(track.license)
  const lines: PillLine[] = [{ key: 'title', text: title }]
  if (level === 3) {
    if (credit) lines.push({ key: 'credit', text: credit })
    if (license) lines.push({ key: 'license', text: license })
  } else if (level === 2) {
    const rest = [credit, license].filter(Boolean).join(' · ')
    if (rest) lines.push({ key: 'creditLicense', text: rest })
  }
  return lines
}

// Once per track and session: when the music first becomes audible, unless the
// guided tour is pointing at the control (then it waits for the tour to end).
export const shouldAutoShowPill = ({
  playing,
  alreadyShown,
  tourOnControl,
}: {
  playing: boolean
  alreadyShown: boolean
  tourOnControl: boolean
}): boolean => playing && !alreadyShown && !tourOnControl

export const pillVisible = ({
  timed,
  hovered,
  focused,
  popoverOpen,
  tourOnControl,
}: {
  timed: boolean
  hovered: boolean
  focused: boolean
  popoverOpen: boolean
  tourOnControl: boolean
}): boolean => !popoverOpen && !tourOnControl && (timed || hovered || focused)

// Tracks whose pill has already appeared in this page session. It outlives the
// control, which remounts when the stage does (2D/3D).
const seen = new Set<string>()
export const pillSeen = (assetId: string) => seen.has(assetId)
export const markPillSeen = (assetId: string) => void seen.add(assetId)
