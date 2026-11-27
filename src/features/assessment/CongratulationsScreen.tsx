import { useEffect, useId, useRef } from 'react'
import { PartyPopper } from 'lucide-react'
import { Button } from '../../components/ui/Button.tsx'
import { Card } from '../../components/ui/Card.tsx'
import type { ResolvedCongratulations } from './congratulations.ts'
import type { ResolvedJourneyText } from './journeyTexts.ts'

// The congratulations screen on the Rumbos card. The text arrives already resolved (the author's
// plain text or the default, placeholders replaced) and is rendered as text only: no markup is
// ever built from it. `simulated` marks a screen an editor is trying out.
export const CongratulationsScreen = ({
  text,
  onContinue,
  simulated = false,
  autoFocus = true,
}: {
  text: ResolvedCongratulations
  onContinue: () => void
  simulated?: boolean
  autoFocus?: boolean
}) => {
  const heading = useRef<HTMLHeadingElement>(null)
  const titleId = useId()
  useEffect(() => {
    if (autoFocus) heading.current?.focus()
  }, [autoFocus])
  return (
    <section
      aria-labelledby={titleId}
      data-testid="congratulations"
      data-simulated={simulated ? 'true' : undefined}
      className="flex justify-center p-4"
    >
      <Card className="flex w-full max-w-xl flex-col items-center gap-4 p-6 text-center text-ink">
        <span aria-hidden className="text-sun-dark">
          <PartyPopper size={40} strokeWidth={2.5} />
        </span>
        <h2
          ref={heading}
          tabIndex={-1}
          id={titleId}
          className="font-heading text-3xl font-extrabold"
        >
          {text.title}
        </h2>
        <p className="flow-prose whitespace-pre-line" data-testid="congratulations-body">
          {text.body}
        </p>
        <Button onClick={onContinue}>{text.ctaLabel}</Button>
      </Card>
    </section>
  )
}

// What a student sees once the final exam's attempts are spent. It performs nothing and
// promises nothing: no restart of the course exists.
export const ExhaustedScreen = ({
  text,
  onContinue,
  autoFocus = true,
}: {
  text: ResolvedJourneyText
  onContinue: () => void
  autoFocus?: boolean
}) => {
  const heading = useRef<HTMLHeadingElement>(null)
  const titleId = useId()
  useEffect(() => {
    if (autoFocus) heading.current?.focus()
  }, [autoFocus])
  return (
    <section aria-labelledby={titleId} data-testid="exhausted" className="flex justify-center p-4">
      <Card className="flex w-full max-w-xl flex-col items-center gap-4 p-6 text-center text-ink">
        <h2
          ref={heading}
          tabIndex={-1}
          id={titleId}
          className="font-heading text-3xl font-extrabold"
        >
          {text.title}
        </h2>
        <p className="flow-prose whitespace-pre-line">{text.body}</p>
        <Button onClick={onContinue}>{text.ctaLabel}</Button>
      </Card>
    </section>
  )
}
