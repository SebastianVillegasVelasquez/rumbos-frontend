import { Button } from '../../components/ui/Button.tsx'
import { Card } from '../../components/ui/Card.tsx'
import { esCongratulations } from '../../i18n/congratulations.es.ts'
import type { MapCongratulations } from '../course-map/data/types.ts'
import { congratulationsValues, remainingContent } from './closingJourney.ts'
import type { ClosingStatus } from './closingStatus.ts'
import { resolveCongratulations } from './congratulations.ts'
import { CongratulationsScreen, ExhaustedScreen } from './CongratulationsScreen.tsx'
import type { JourneyScreen } from './journeyScreens.ts'
import { routeInstructions } from './journeyTexts.ts'

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
  finalThreshold = null,
}: {
  screen: JourneyScreen
  congratulations: MapCongratulations | null | undefined
  status: ClosingStatus | null
  onContinue: () => void
  simulated?: boolean
  // The pass mark of the final that was decided, where it is known (a simulation).
  finalThreshold?: number | null
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
          congratulationsValues(
            status,
            screen === 'congrats_checkin' ? 'checkin' : 'final',
            finalThreshold
          ),
          status?.outcome?.checkin?.passOperator ?? null
        )}
      />
    )}
  </div>
)

// A card over the foot of the map: the journey's next step, without taking the map away.
const MapCard = ({
  testId,
  title,
  body,
  cta,
  onPress,
}: {
  testId: string
  title: string
  body: string
  cta: string
  onPress: () => void
}) => (
  <div className="pointer-events-none absolute inset-x-0 bottom-24 z-30 flex justify-center px-3">
    <Card
      data-testid={testId}
      role="region"
      aria-label={title}
      className="pointer-events-auto flex max-w-md flex-col items-start gap-2 p-4 text-ink"
    >
      <p className="font-heading text-lg font-extrabold">{title}</p>
      <p className="text-sm font-semibold">{body}</p>
      <Button onClick={onPress}>{cta}</Button>
    </Card>
  </div>
)

// Once the required content is done: a card that offers the closing. It never opens the
// closing by itself; the student presses the button. `failure` stands in for the result screen
// when a simulated attempt was failed from the panel, which shows none.
export const ClosingCard = ({
  status,
  onOpen,
  failure = null,
}: {
  status: ClosingStatus
  onOpen: () => void
  failure?: { title: string; body: string } | null
}) => {
  const text = esCongratulations.journey
  const left = remainingContent(status)
  return (
    <MapCard
      testId="closing-card"
      title={failure?.title ?? text.closingCardTitle}
      body={
        failure?.body ??
        (left !== null && left > 0 ? text.closingRemaining(left) : text.closingCardBody)
      }
      cta={text.closingCardCta}
      onPress={onOpen}
    />
  )
}

// After a failed check-in, on the map: how to get to the final exam.
export const RouteCard = ({ onDismiss }: { onDismiss: () => void }) => {
  const text = esCongratulations.journey
  return (
    <MapCard
      testId="route-card"
      title={text.routeTitle}
      body={routeInstructions()}
      cta={text.routeCta}
      onPress={onDismiss}
    />
  )
}
