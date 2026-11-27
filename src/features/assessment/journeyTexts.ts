import { esCongratulations } from '../../i18n/congratulations.es.ts'
import type { MapJourneyText, MapSettings } from '../course-map/data/types.ts'
import { CONGRATULATIONS_LIMITS, fillPlaceholders, plain } from './congratulations.ts'

// The journey's messages to a student who has not passed, in one place: what the editor wrote
// (`MapSettings.failure`, `exhausted`, `routeInstructions`; plain text) or, field by field,
// Rumbos' copy. The result is a string for React to render as text.

const text = esCongratulations.journey

export type JourneyBlock = 'failure' | 'exhausted' | 'routeInstructions'

export type JourneySettings = Pick<MapSettings, JourneyBlock>

// The placeholders the backend accepts per block; any other brace is refused when saving.
export const JOURNEY_PLACEHOLDERS: Record<JourneyBlock, readonly string[]> = {
  failure: ['attempt', 'attempts_max', 'attempts_left', 'threshold'],
  exhausted: [],
  routeInstructions: [],
}

export interface ResolvedJourneyText {
  title: string
  body: string
  ctaLabel: string
}

const resolve = (
  custom: MapJourneyText | null | undefined,
  fallback: ResolvedJourneyText,
  values: Record<string, string>
): ResolvedJourneyText => {
  const pick = (field: keyof ResolvedJourneyText, multiline: boolean): string => {
    const own = plain(custom?.[field], CONGRATULATIONS_LIMITS[field], multiline)
    // A sentence with a hole where a value goes would read as broken.
    const holed = Object.entries(values).some(
      ([name, value]) => value === '' && own.includes(`{${name}}`)
    )
    return own === '' || holed ? fallback[field] : fillPlaceholders(own, values).trim()
  }
  return {
    title: pick('title', false),
    body: pick('body', true),
    ctaLabel: pick('ctaLabel', false),
  }
}

export const routeInstructionsText = (
  settings: JourneySettings | null | undefined
): ResolvedJourneyText =>
  resolve(
    settings?.routeInstructions,
    { title: text.routeTitle, body: text.routeBody, ctaLabel: text.routeCta },
    {}
  )

export const exhaustedText = (settings: JourneySettings | null | undefined): ResolvedJourneyText =>
  resolve(
    settings?.exhausted,
    { title: text.exhaustedTitle, body: text.exhaustedBody, ctaLabel: text.exhaustedCta },
    {}
  )

export interface FailureValues {
  // The attempt just failed, and how many the student has in all.
  attempt: number
  max: number
  // The pass mark that attempt was graded with; null when unknown.
  threshold: number | null
}

// After a failed final attempt: which one it was, and what is left. `ctaLabel` is the label
// of the button that leaves the result; '' keeps that button's own.
export const failureText = (
  settings: JourneySettings | null | undefined,
  { attempt, max, threshold }: FailureValues
): ResolvedJourneyText => {
  const left = Math.max(0, max - attempt)
  return resolve(
    settings?.failure,
    {
      title: text.failureTitle(attempt, max),
      body: left > 0 ? text.failureBody(left, max) : exhaustedText(settings).body,
      ctaLabel: '',
    },
    {
      attempt: String(attempt),
      attempts_max: String(max),
      attempts_left: String(left),
      threshold: threshold === null ? '' : String(threshold),
    }
  )
}

// What a field holds after an edit: empty text is "use the default", which is null on the
// wire, and a block with nothing left is null.
export const setJourneyTextField = (
  settings: MapSettings,
  block: JourneyBlock,
  field: keyof MapJourneyText,
  value: string
): MapSettings => {
  const next: MapJourneyText = { ...(settings[block] ?? {}), [field]: value === '' ? null : value }
  const empty = Object.values(next).every((item) => item === null || item === undefined)
  return { ...settings, [block]: empty ? null : next }
}
