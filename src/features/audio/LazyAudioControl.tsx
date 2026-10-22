import { Suspense, lazy } from 'react'
import type { AudioTrack } from './audioSession.ts'

// All audio code (the session, the control, the fades) stays out of the initial
// bundle: it loads only for a map that has music.
const AudioControl = lazy(() => import('./AudioControl.tsx'))

export const LazyAudioControl = ({ track }: { track: AudioTrack }) => (
  <Suspense fallback={null}>
    <AudioControl track={track} />
  </Suspense>
)
