import { useId } from 'react'
import { Input } from '../../../components/ui/Input.tsx'
import { Button } from '../../../components/ui/Button.tsx'
import { esCongratulations } from '../../../i18n/congratulations.es.ts'
import type { MapCongratulationsText, MapSettings } from '../../course-map/data/types.ts'
import { CongratulationsScreen } from '../CongratulationsScreen.tsx'
import {
  CONGRATULATIONS_LIMITS,
  clearCongratulations,
  resolveCongratulations,
  setCongratulationsField,
  usesUnavailableScore,
  type CongratulationsPurpose,
} from '../congratulations.ts'
import { assessmentsOf } from './trainingForm.ts'

const text = esCongratulations.editor
const PURPOSES: CongratulationsPurpose[] = ['checkin', 'final']
const labelClass = 'text-xs font-bold uppercase tracking-wide text-ink-soft'
const areaClass =
  'border-soft min-h-[88px] w-full rounded-md bg-surface px-3 py-2 text-sm font-semibold text-ink'

const Counter = ({ used, max }: { used: number; max: number }) => (
  <span className="text-xs font-semibold text-ink-soft" aria-hidden>
    {text.counter(used, max)}
  </span>
)

const PurposeEditor = ({
  purpose,
  settings,
  onChange,
}: {
  purpose: CongratulationsPurpose
  settings: MapSettings
  onChange: (next: MapSettings) => void
}) => {
  const ids = { title: useId(), body: useId(), cta: useId(), help: useId() }
  const own = settings.congratulations?.[purpose] ?? {}
  const set = (field: keyof MapCongratulationsText) => (value: string) =>
    onChange(setCongratulationsField(settings, purpose, field, value))
  // The preview shows the screen as a student would see it: the map's pass mark, and an example
  // score only where the student's screen has one.
  const resolved = resolveCongratulations(purpose, settings.congratulations, {
    score: purpose === 'checkin' ? text.previewScore : null,
    threshold: assessmentsOf(settings).passPercent,
  })
  const asksForScore = Object.values(own).some((value) => usesUnavailableScore(purpose, value))
  return (
    <fieldset className="space-y-3 rounded-md border border-line p-3">
      <legend className="px-1 text-sm font-extrabold text-ink">{text.purposes[purpose]}</legend>
      <div className="space-y-1">
        <label htmlFor={ids.title} className={labelClass}>
          {text.title}
        </label>
        <Input
          id={ids.title}
          density="compact"
          maxLength={CONGRATULATIONS_LIMITS.title}
          value={own.title ?? ''}
          aria-describedby={ids.help}
          onChange={(event) => set('title')(event.target.value)}
        />
        <Counter used={(own.title ?? '').length} max={CONGRATULATIONS_LIMITS.title} />
      </div>
      <div className="space-y-1">
        <label htmlFor={ids.body} className={labelClass}>
          {text.body}
        </label>
        <textarea
          id={ids.body}
          rows={3}
          maxLength={CONGRATULATIONS_LIMITS.body}
          value={own.body ?? ''}
          aria-describedby={ids.help}
          className={areaClass}
          onChange={(event) => set('body')(event.target.value)}
        />
        <Counter used={(own.body ?? '').length} max={CONGRATULATIONS_LIMITS.body} />
      </div>
      <div className="space-y-1">
        <label htmlFor={ids.cta} className={labelClass}>
          {text.ctaLabel}
        </label>
        <Input
          id={ids.cta}
          density="compact"
          maxLength={CONGRATULATIONS_LIMITS.ctaLabel}
          value={own.ctaLabel ?? ''}
          aria-describedby={ids.help}
          onChange={(event) => set('ctaLabel')(event.target.value)}
        />
        <Counter used={(own.ctaLabel ?? '').length} max={CONGRATULATIONS_LIMITS.ctaLabel} />
      </div>
      <p id={ids.help} className="text-xs font-semibold text-ink-soft">
        {text.placeholders[purpose]}
      </p>
      {asksForScore && (
        <p role="alert" className="rounded-md bg-sun-tint p-2 text-xs font-bold text-sun-dark">
          {text.scoreUnavailable}
        </p>
      )}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onChange(clearCongratulations(settings, purpose))}
      >
        {text.reset}
      </Button>
      <div
        role="group"
        aria-label={`${text.previewLabel}: ${text.purposes[purpose]}`}
        className="rounded-md bg-surface-muted p-2"
      >
        <p className={labelClass}>{text.preview}</p>
        <CongratulationsScreen text={resolved} onContinue={() => {}} autoFocus={false} simulated />
      </div>
    </fieldset>
  )
}

// The editor of the two congratulations screens, each with a live preview on the real card.
export const CongratulationsEditor = ({
  settings,
  onChange,
}: {
  settings: MapSettings
  onChange: (next: MapSettings) => void
}) => (
  <section aria-label={text.heading} className="mt-6 space-y-3">
    <h3 className="text-base font-extrabold text-ink">{text.heading}</h3>
    <p className="text-sm font-semibold text-ink-soft">{text.intro}</p>
    {PURPOSES.map((purpose) => (
      <PurposeEditor key={purpose} purpose={purpose} settings={settings} onChange={onChange} />
    ))}
  </section>
)
