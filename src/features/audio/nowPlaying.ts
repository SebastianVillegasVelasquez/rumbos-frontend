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
