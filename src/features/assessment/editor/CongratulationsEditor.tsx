import { useId } from 'react'
import { Button } from '../../../components/ui/Button.tsx'
import { esCongratulations } from '../../../i18n/congratulations.es.ts'
import type { MapSettings } from '../../course-map/data/types.ts'
import { CongratulationsScreen } from '../CongratulationsScreen.tsx'
import {
  clearCongratulations,
  resolveCongratulations,
  setCongratulationsField,
  type CongratulationsPurpose,
} from '../congratulations.ts'
import type { SettingsIssue } from './settingsIssues.ts'
import { labelClass, TextBlockFields } from './TextBlockFields.tsx'
import { assessmentsOf } from './trainingForm.ts'

const text = esCongratulations.editor
const PURPOSES: CongratulationsPurpose[] = ['checkin', 'final']
const PurposeEditor = ({
  purpose,
  settings,
  issues,
  onChange,
}: {
  purpose: CongratulationsPurpose
  settings: MapSettings
  issues: readonly SettingsIssue[]
  onChange: (next: MapSettings) => void
}) => {
  const helpId = useId()
  // The preview shows the screen as a student would see it: the map's pass mark and an example
  // score.
  const resolved = resolveCongratulations(purpose, settings.congratulations, {
    score: text.previewScore,
    threshold: assessmentsOf(settings).passPercent,
  })
  return (
    <fieldset className="space-y-3 rounded-md border border-line p-3">
      <legend className="px-1 text-sm font-extrabold text-ink">{text.purposes[purpose]}</legend>
      <TextBlockFields
        path={`congratulations.${purpose}`}
        value={settings.congratulations?.[purpose] ?? {}}
        helpId={helpId}
        issues={issues}
        onChange={(field, value) =>
          onChange(setCongratulationsField(settings, purpose, field, value))
        }
      />
      <p id={helpId} className="text-xs font-semibold text-ink-soft">
        {text.placeholders}
      </p>
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
  issues,
  onChange,
}: {
  settings: MapSettings
  issues: readonly SettingsIssue[]
  onChange: (next: MapSettings) => void
}) => (
  <section aria-label={text.heading} className="mt-6 space-y-3">
    <h3 className="text-base font-extrabold text-ink">{text.heading}</h3>
    <p className="text-sm font-semibold text-ink-soft">{text.intro}</p>
    {PURPOSES.map((purpose) => (
      <PurposeEditor
        key={purpose}
        purpose={purpose}
        settings={settings}
        issues={issues}
        onChange={onChange}
      />
    ))}
  </section>
)
