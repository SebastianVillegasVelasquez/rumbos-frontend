import { esCongratulations } from '../../i18n/congratulations.es.ts'
import type { MapCongratulationsText, MapSettings } from '../course-map/data/types.ts'

// The congratulations screen's text. What the editor wrote (plain text, `MapSettings.congratulations`)
// or, field by field, the default copy; then `{score}` and `{threshold}` replaced by the app.
// The result is a string for React to render as text: nothing here, and nothing in the screen,
// builds markup from it.

export type CongratulationsPurpose = 'checkin' | 'final'

export interface CongratulationsText {
  title?: string | null
  body?: string | null
  ctaLabel?: string | null
}

export interface Congratulations {
  checkin?: CongratulationsText | null
  final?: CongratulationsText | null
}

// The limits the contract declares.
export const CONGRATULATIONS_LIMITS = { title: 80, body: 600, ctaLabel: 40 } as const

export interface CongratulationsValues {
  // The score of the attempt that decided it, as the backend reports it; null when unknown.
  score: string | null
  threshold: number | null
}

export interface ResolvedCongratulations {
  title: string
  body: string
  ctaLabel: string
}

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F]/g

// Plain text, bounded, with no control characters. Line breaks stay in the body only.
export const plain = (
  value: string | null | undefined,
  max: number,
  multiline: boolean
): string => {
  if (typeof value !== 'string') return ''
  const cleaned = value.slice(0, max * 2).replace(CONTROL, '')
  const oneLine = multiline ? cleaned : cleaned.replace(/[\r\n]+/g, ' ')
  return oneLine.trim().slice(0, max)
}

// 85.50 -> 85.5, 85.00 -> 85: the score as a person would write it.
export const formatScore = (score: string | null): string => {
  if (score === null) return ''
  const value = Number(score)
  return Number.isFinite(value) ? String(Number(value.toFixed(2))) : ''
}

// One pass over the template, replacing exactly the named placeholders: a value is never read
// again, and any other brace stays as the author wrote it, as text.
export const fillPlaceholders = (template: string, values: Record<string, string>): string =>
  template
    .replace(/\{([a-z_]+)\}/g, (found, name: string) =>
      Object.hasOwn(values, name) ? values[name] : found
    )
    .replace(/[ \t]{2,}/g, ' ')

export const substitute = (template: string, values: CongratulationsValues): string =>
  fillPlaceholders(template, {
    score: formatScore(values.score),
    threshold: values.threshold === null ? '' : String(values.threshold),
  })

const defaultsFor = (
  purpose: CongratulationsPurpose,
  values: CongratulationsValues,
  operator: 'gt' | 'gte' | null
): ResolvedCongratulations => {
  const text = esCongratulations.defaults
  if (purpose === 'final') return { ...text.final }
  const body =
    values.threshold === null
      ? text.checkin.bodyUnknown
      : operator === 'gte'
        ? text.checkin.bodyGte
        : text.checkin.bodyGt
  return { title: text.checkin.title, body, ctaLabel: text.checkin.ctaLabel }
}

export const resolveCongratulations = (
  purpose: CongratulationsPurpose,
  settings: Congratulations | null | undefined,
  values: CongratulationsValues,
  operator: 'gt' | 'gte' | null = null
): ResolvedCongratulations => {
  const custom = settings?.[purpose] ?? null
  const fallback = defaultsFor(purpose, values, operator)
  const pick = (value: string | null | undefined, max: number, multiline: boolean, def: string) => {
    const own = plain(value, max, multiline)
    // A sentence with a hole where the score goes would read as broken.
    // A sentence with a hole where the score goes would read as broken.
    const unusable = own === '' || (values.score === null && own.includes('{score}'))
    return substitute(unusable ? def : own, values).trim()
  }
  return {
    title: pick(custom?.title, CONGRATULATIONS_LIMITS.title, false, fallback.title),
    body: pick(custom?.body, CONGRATULATIONS_LIMITS.body, true, fallback.body),
    ctaLabel: pick(custom?.ctaLabel, CONGRATULATIONS_LIMITS.ctaLabel, false, fallback.ctaLabel),
  }
}

// What a field holds after an edit: empty text is "use the default", which is null on the wire,
// and a purpose with nothing left is null; with both empty the whole key is null.
export const setCongratulationsField = (
  settings: MapSettings,
  purpose: CongratulationsPurpose,
  field: keyof MapCongratulationsText,
  value: string
): MapSettings => {
  const current = settings.congratulations?.[purpose] ?? {}
  const next: MapCongratulationsText = { ...current, [field]: value === '' ? null : value }
  const empty = Object.values(next).every((item) => item === null || item === undefined)
  const all = { ...(settings.congratulations ?? {}), [purpose]: empty ? null : next }
  return { ...settings, congratulations: !all.checkin && !all.final ? null : all }
}

export const clearCongratulations = (
  settings: MapSettings,
  purpose: CongratulationsPurpose
): MapSettings => {
  const all = { ...(settings.congratulations ?? {}), [purpose]: null }
  return { ...settings, congratulations: !all.checkin && !all.final ? null : all }
}
