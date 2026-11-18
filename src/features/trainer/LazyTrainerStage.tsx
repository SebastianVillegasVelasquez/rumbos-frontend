import {
  Component,
  Suspense,
  lazy,
  useState,
  type ComponentProps,
  type ErrorInfo,
  type ReactNode,
} from 'react'
import { Button } from '../../components/ui/Button.tsx'
import { es } from '../../i18n/es.ts'

// The whole trainer (its screens, its runners, its copy) stays out of the embed's
// first download and loads when a student presses "Entrenar".
const loadStage = () => import('./TrainerStage.tsx')
// A rejected lazy component stays rejected, so a retry swaps in a fresh one.
let Stage = lazy(loadStage)
const renewStage = () => {
  Stage = lazy(loadStage)
}
type StageProps = ComponentProps<Awaited<ReturnType<typeof loadStage>>['default']>

// A chunk that cannot be fetched (offline, or a deploy changed its name) throws while
// rendering. Left alone it would take the map down with it: this says what happened,
// with a retry and the way back, in the same place the stage would be.
class ChunkBoundary extends Component<
  { onRetry: () => void; onClose: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('The trainer could not be loaded', error, info.componentStack)
    // The next attempt, retry or a later press of the button, starts from a fresh one.
    renewStage()
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={es.hud.trainer}
        className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-ink p-6 text-center text-white"
      >
        <p role="alert" className="text-base font-bold">
          {es.hud.trainerChunk.failed}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="secondary" onClick={this.props.onClose}>
            {es.hud.trainerChunk.back}
          </Button>
          <Button
            onClick={() => {
              this.setState({ failed: false })
              this.props.onRetry()
            }}
          >
            {es.hud.trainerChunk.retry}
          </Button>
        </div>
      </div>
    )
  }
}

export const LazyTrainerStage = (props: StageProps) => {
  const [attempt, setAttempt] = useState(0)
  return (
    <ChunkBoundary
      key={attempt}
      onRetry={() => setAttempt((value) => value + 1)}
      onClose={props.onClose}
    >
      <Suspense fallback={<div className="absolute inset-0 z-40 bg-ink" />}>
        <Stage {...props} />
      </Suspense>
    </ChunkBoundary>
  )
}
