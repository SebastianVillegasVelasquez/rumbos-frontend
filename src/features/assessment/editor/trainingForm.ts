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
  formIdMax: 64,
} as const

// No form is chosen for the author: an empty formId means "not selected yet", and a
// map with the assessments on cannot be saved until each purpose has one.
export const NO_FORM = ''

export const defaultTrainer = (): MapTrainer => ({ enabled: false, language: 'en', level: 'A1' })

export const defaultAssessments = (): MapAssessments => ({
  enabled: false,
  checkIn: { formId: NO_FORM, maxAttempts: 1, timeLimitMin: 60 },
  final: { formId: NO_FORM, maxAttempts: 3, timeLimitMin: 60 },
  passPercent: 80,
  passOperator: 'gt',
  exemption: { enabled: true },
})

export const levelHasContent = (language: 'en', level: TrainerLevel): boolean =>
  TRAINER_PACKS.some((pack) => pack.language === language && pack.levels.includes(level))

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.round(Number.isFinite(value) ? value : min)))

// The server may send a partial object (e.g. `{ enabled: false }`), so every part is
// merged over its default; the editor never reads a missing rule.
export const trainerOf = (settings: MapSettings): MapTrainer => ({
  ...defaultTrainer(),
  ...settings.trainer,
})
export const assessmentsOf = (settings: MapSettings): MapAssessments => {
  const base = defaultAssessments()
  const given: Partial<MapAssessments> = settings.assessments ?? {}
  return {
    ...base,
    ...given,
    checkIn: { ...base.checkIn, ...given.checkIn },
    final: { ...base.final, ...given.final },
    exemption: { ...base.exemption, ...given.exemption },
  }
}

export const setTrainer = (settings: MapSettings, patch: Partial<MapTrainer>): MapSettings => {
  const next = { ...trainerOf(settings), ...patch }
  // A level without content cannot be chosen.
  if (!levelHasContent(next.language, next.level)) next.level = 'A1'
  return { ...settings, trainer: next }
}

export type Purpose = 'check_in' | 'final'

// The purpose is how the exam is named in URLs and steps (`check_in`); the settings spell
// the same exam `checkIn`, as the contract does. The one translation between the two.
export const rulesKey = (purpose: Purpose): 'checkIn' | 'final' =>
  purpose === 'check_in' ? 'checkIn' : 'final'

export const setRules = (
  settings: MapSettings,
  purpose: Purpose,
  patch: Partial<Pick<AssessmentRules, 'maxAttempts' | 'timeLimitMin' | 'formId'>>
): MapSettings => {
  const current = assessmentsOf(settings)
  const rules = { ...current[rulesKey(purpose)] }
  // Kept as typed (a blank one is the author's to fix, and the save says so).
  if (patch.formId !== undefined) rules.formId = patch.formId.slice(0, LIMITS.formIdMax)
  if (patch.maxAttempts !== undefined)
    rules.maxAttempts = clamp(patch.maxAttempts, LIMITS.attempts.min, LIMITS.attempts.max)
  if (patch.timeLimitMin !== undefined)
    rules.timeLimitMin = clamp(patch.timeLimitMin, LIMITS.minutes.min, LIMITS.minutes.max)
  return { ...settings, assessments: { ...current, [rulesKey(purpose)]: rules } }
}

export const setPolicy = (
  settings: MapSettings,
  patch: Partial<Pick<MapAssessments, 'enabled' | 'passPercent' | 'passOperator'>> & {
    exemption?: boolean
  }
): MapSettings => {
  const current = assessmentsOf(settings)
  const next: MapAssessments = { ...current }
  if (patch.enabled !== undefined) next.enabled = patch.enabled
  if (patch.passOperator !== undefined) next.passOperator = patch.passOperator
  if (patch.passPercent !== undefined)
    next.passPercent = clamp(patch.passPercent, LIMITS.percent.min, LIMITS.percent.max)
  if (patch.exemption !== undefined) next.exemption = { enabled: patch.exemption }
  return { ...settings, assessments: next }
}

// Turn the assessments on for the check-in step, which cannot work without them. The
// rest of the rules stay as they are. Returns the same object when already on.
export const enableAssessments = (settings: MapSettings): MapSettings =>
  assessmentsOf(settings).enabled ? settings : setPolicy(settings, { enabled: true })

// Editing is available only where the backend knows the feature.
export const trainingSupported = (settings: MapSettings): boolean =>
  'trainer' in settings || 'assessments' in settings
