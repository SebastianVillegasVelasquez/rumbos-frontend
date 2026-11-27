import { useId, type ReactNode } from 'react'
import { Button } from '../../../components/ui/Button.tsx'
import { esCongratulations } from '../../../i18n/congratulations.es.ts'
import type { MapSettings } from '../../course-map/data/types.ts'
import { ExhaustedScreen } from '../CongratulationsScreen.tsx'
import { MapCard, RouteCard } from '../JourneyOverlay.tsx'
import {
  exhaustedText,
  failureText,
  routeInstructionsText,
  setJourneyTextField,
  type JourneyBlock,
} from '../journeyTexts.ts'
import type { SettingsIssue } from './settingsIssues.ts'
import { labelClass, TextBlockFields } from './TextBlockFields.tsx'
import { assessmentsOf } from './trainingForm.ts'

const text = esCongratulations.journeyEditor
const BLOCKS: JourneyBlock[] = ['failure', 'exhausted', 'routeInstructions']

// What the student sees, on the same card. The failure preview shows a first failed attempt
// with the map's own number of attempts and pass mark.
const preview = (block: JourneyBlock, settings: MapSettings): ReactNode => {
  if (block === 'exhausted')
    return (
      <ExhaustedScreen text={exhaustedText(settings)} onContinue={() => {}} autoFocus={false} />
    )
  if (block === 'routeInstructions')
    return <RouteCard text={routeInstructionsText(settings)} onDismiss={() => {}} inline />
  const assessments = assessmentsOf(settings)
  const shown = failureText(settings, {
    attempt: 1,
    max: assessments.final?.maxAttempts ?? 3,
    threshold: assessments.passPercent,
  })
  return (
    <MapCard
      testId="failure-preview"
      title={shown.title}
      body={shown.body}
      cta={shown.ctaLabel || text.defaultCta}
      onPress={() => {}}
      inline
    />
  )
}

const BlockEditor = ({
  block,
  settings,
  issues,
  onChange,
}: {
  block: JourneyBlock
  settings: MapSettings
  issues: readonly SettingsIssue[]
  onChange: (next: MapSettings) => void
}) => {
  const helpId = useId()
  return (
    <fieldset className="space-y-3 rounded-md border border-line p-3">
      <legend className="px-1 text-sm font-extrabold text-ink">{text.blocks[block]}</legend>
      <TextBlockFields
        path={block}
        value={settings[block] ?? {}}
        helpId={helpId}
        issues={issues}
        onChange={(field, value) => onChange(setJourneyTextField(settings, block, field, value))}
      />
      <p id={helpId} className="text-xs font-semibold text-ink-soft">
        {text.help[block]}
      </p>
      <Button size="sm" variant="ghost" onClick={() => onChange({ ...settings, [block]: null })}>
        {esCongratulations.editor.reset}
      </Button>
      <div
        role="group"
        aria-label={`${esCongratulations.editor.previewLabel}: ${text.blocks[block]}`}
        className="rounded-md bg-surface-muted p-2"
      >
        <p className={labelClass}>{esCongratulations.editor.preview}</p>
        {preview(block, settings)}
      </div>
    </fieldset>
  )
}

// The editor of the texts for a student who has not passed. A text is offered only where the
// backend's map has its key: one that predates it refuses an undeclared field.
export const JourneyTextsEditor = ({
  saved,
  settings,
  issues,
  onChange,
}: {
  // The map's settings as the backend sent them.
  saved: MapSettings
  settings: MapSettings
  issues: readonly SettingsIssue[]
  onChange: (next: MapSettings) => void
}) => {
  const blocks = BLOCKS.filter((block) => block in saved)
  if (blocks.length === 0) return null
  return (
    <section aria-label={text.heading} className="mt-6 space-y-3">
      <h3 className="text-base font-extrabold text-ink">{text.heading}</h3>
      <p className="text-sm font-semibold text-ink-soft">{text.intro}</p>
      {blocks.map((block) => (
        <BlockEditor
          key={block}
          block={block}
          settings={settings}
          issues={issues}
          onChange={onChange}
        />
      ))}
    </section>
  )
}
