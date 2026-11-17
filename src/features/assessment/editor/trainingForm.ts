import type {
  AssessmentRules,
  MapAssessments,
  MapSettings,
  MapTrainer,
  TrainerLevel,
} from '../../course-map/data/types.ts'

// The editor's model of "Entrenamiento y evaluación": defaults, the limits the
// inputs clamp to, and pure updates of the settings. Pure so the rules are tested.
// Values are clamped as they are typed, so the settings never hold an invalid one.

// The packs that have content. Language and level are data, but only A1 in English
// exists; the other levels are listed as "sin contenido todavía" and cannot be chosen.
export const TRAINER_PACKS: ReadonlyArray<{ language: 'en'; levels: readonly TrainerLevel[] }> = [
  { language: 'en', levels: ['A1'] },
]
export const ALL_LEVELS: readonly TrainerLevel[] = ['A1', 'A2', 'B1', 'B2']

export const LIMITS = {
  attempts: { min: 1, max: 10 },
  minutes: { min: 5, max: 240 },
  percent: { min: 0, max: 100 },
} as const

// ASSUMPTION (contract v2 names a form_id but no list of forms): the A1 Forma A
// form has this id until the backend says otherwise.
export const DEFAULT_FORM_ID = 'forma_a'

export const defaultTrainer = (): MapTrainer => ({ enabled: false, language: 'en', level: 'A1' })

export const defaultAssessments = (): MapAssessments => ({
  enabled: false,
  check_in: { form_id: DEFAULT_FORM_ID, max_attempts: 1, time_limit_min: 60 },
  final: { form_id: DEFAULT_FORM_ID, max_attempts: 3, time_limit_min: 60 },
  pass_percent: 80,
  pass_operator: 'gt',
  exemption: { enabled: true },
})

export const levelHasContent = (language: 'en', level: TrainerLevel): boolean =>
  TRAINER_PACKS.some((pack) => pack.language === language && pack.levels.includes(level))

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.round(Number.isFinite(value) ? value : min)))

export const trainerOf = (settings: MapSettings): MapTrainer => settings.trainer ?? defaultTrainer()
export const assessmentsOf = (settings: MapSettings): MapAssessments =>
  settings.assessments ?? defaultAssessments()

export const setTrainer = (settings: MapSettings, patch: Partial<MapTrainer>): MapSettings => {
  const next = { ...trainerOf(settings), ...patch }
  // A level without content cannot be chosen.
  if (!levelHasContent(next.language, next.level)) next.level = 'A1'
  return { ...settings, trainer: next }
}

export type Purpose = 'check_in' | 'final'

export const setRules = (
  settings: MapSettings,
  purpose: Purpose,
  patch: Partial<Pick<AssessmentRules, 'max_attempts' | 'time_limit_min'>>
): MapSettings => {
  const current = assessmentsOf(settings)
  const rules = { ...current[purpose] }
  if (patch.max_attempts !== undefined)
    rules.max_attempts = clamp(patch.max_attempts, LIMITS.attempts.min, LIMITS.attempts.max)
  if (patch.time_limit_min !== undefined)
    rules.time_limit_min = clamp(patch.time_limit_min, LIMITS.minutes.min, LIMITS.minutes.max)
  return { ...settings, assessments: { ...current, [purpose]: rules } }
}

export const setPolicy = (
  settings: MapSettings,
  patch: Partial<Pick<MapAssessments, 'enabled' | 'pass_percent' | 'pass_operator'>> & {
    exemption?: boolean
  }
): MapSettings => {
  const current = assessmentsOf(settings)
  const next: MapAssessments = { ...current }
  if (patch.enabled !== undefined) next.enabled = patch.enabled
  if (patch.pass_operator !== undefined) next.pass_operator = patch.pass_operator
  if (patch.pass_percent !== undefined)
    next.pass_percent = clamp(patch.pass_percent, LIMITS.percent.min, LIMITS.percent.max)
  if (patch.exemption !== undefined) next.exemption = { enabled: patch.exemption }
  return { ...settings, assessments: next }
}

// Editing is available only where the backend knows the feature.
export const trainingSupported = (settings: MapSettings): boolean =>
  'trainer' in settings || 'assessments' in settings
