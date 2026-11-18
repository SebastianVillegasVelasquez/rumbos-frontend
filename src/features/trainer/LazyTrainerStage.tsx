import {
  Component,
  Suspense,
  lazy,
  useState,
  type ComponentProps,
  type ErrorInfo,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '../../components/ui/Button.tsx'
import { es } from '../../i18n/es.ts'
import { describeStageFailure } from './stageFailure.ts'

// The whole trainer (its screens, its runners, its copy) stays out of the embed's
// first download and loads when a student presses "Entrenar".
const loadStage = () => import('./TrainerStage.tsx')
// A rejected lazy component stays rejected, so a retry swaps in a fresh one.
let Stage = lazy(loadStage)
const renewStage = () => {
  Stage = lazy(loadStage)
}
type StageProps = ComponentProps<Awaited<ReturnType<typeof loadStage>>['default']>

// Whatever throws while the stage loads or renders (a chunk that cannot be fetched,
// offline or renamed by a deploy; a response the screens cannot read) would take the
// map down with it. This says so, with "Reintentar" and "Volver al mapa" in the same
// place the stage would be, and logs the cause: which kind, and for a contract
// failure the endpoint and the fields.
class ChunkBoundary extends Component<
  { onRetry: () => void; onClose: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('The trainer could not be loaded', {
      ...describeStageFailure(error),
      componentStack: info.componentStack,
    })
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
  const client = useQueryClient()
  return (
    <ChunkBoundary
      key={attempt}
      onRetry={() => {
        // A retry asks the server again too: what the stage choked on may be cached.
        void client.resetQueries({ queryKey: ['trainer'] })
        setAttempt((value) => value + 1)
      }}
      onClose={props.onClose}
    >
      <Suspense fallback={<div className="absolute inset-0 z-40 bg-ink" />}>
        <Stage {...props} />
      </Suspense>
    </ChunkBoundary>
  )
}
