import { Button } from '../../components/ui/Button.tsx'
import { Card } from '../../components/ui/Card.tsx'
import { esCongratulations } from '../../i18n/congratulations.es.ts'
import type { MapCongratulations } from '../course-map/data/types.ts'
import { congratulationsValues, remainingContent } from './closingJourney.ts'
import type { ClosingStatus } from './closingStatus.ts'
import { resolveCongratulations } from './congratulations.ts'
import { CongratulationsScreen, ExhaustedScreen } from './CongratulationsScreen.tsx'
import type { JourneyScreen } from './journeyScreens.ts'

// The full-stage screen a student reaches by the journey: congratulations after a passed
// check-in or final, or the "review the content again" screen. What it says comes from the
// backend's status (the score and the threshold) and the author's text; what the buttons do is
// decided by the caller. `simulated` draws the same screens for an editor's simulation.
export const JourneyOverlay = ({
  screen,
  congratulations,
  status,
  onContinue,
  simulated = false,
}: {
  screen: JourneyScreen
  congratulations: MapCongratulations | null | undefined
  status: ClosingStatus | null
  onContinue: () => void
  simulated?: boolean
}) => (
  <div
    role="dialog"
    aria-modal="true"
    aria-label={esCongratulations.screenLabel}
    className="absolute inset-0 z-40 flex items-center justify-center overflow-auto bg-paper"
  >
    {screen === 'exhausted' ? (
      <ExhaustedScreen onContinue={onContinue} />
    ) : (
      <CongratulationsScreen
        simulated={simulated}
        onContinue={onContinue}
        text={resolveCongratulations(
          screen === 'congrats_checkin' ? 'checkin' : 'final',
          congratulations,
          congratulationsValues(status, screen === 'congrats_checkin' ? 'checkin' : 'final'),
          status?.outcome?.checkin?.passOperator ?? null
        )}
      />
    )}
  </div>
)

// On the map, once the required content is done: a card that offers the closing. It never opens
// the closing by itself; the student presses the button.
export const ClosingCard = ({ status, onOpen }: { status: ClosingStatus; onOpen: () => void }) => {
  const text = esCongratulations.journey
  const left = remainingContent(status)
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-24 z-30 flex justify-center px-3">
      <Card
        data-testid="closing-card"
        role="region"
        aria-label={text.closingCardTitle}
        className="pointer-events-auto flex max-w-md flex-col items-start gap-2 p-4 text-ink"
      >
        <p className="font-heading text-lg font-extrabold">{text.closingCardTitle}</p>
        <p className="text-sm font-semibold">
          {left !== null && left > 0 ? text.closingRemaining(left) : text.closingCardBody}
        </p>
        <Button onClick={onOpen}>{text.closingCardCta}</Button>
      </Card>
    </div>
  )
}
