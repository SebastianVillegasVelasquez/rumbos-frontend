import { ApiError } from '../../course-map/data/apiError.ts'
import type { MapSettings } from '../../course-map/data/types.ts'
import { assessmentsOf } from './trainingForm.ts'

// Field-level answers of the settings save (contract, additive): a 422 carries
// `errors: [{ path, rule, message_key }]`, and a successful save may carry the same
// shape as non-blocking `warnings`. Parsed tolerantly: a backend that predates them
// sends neither, and an unknown key is shown with its key rather than hidden.

export interface SettingsIssue {
  path: string
  rule: string
  messageKey: string
}

export type StudioTab = 'training' | 'welcome'

// `settings.assessments.checkIn.formId`, `body.settings...` and `welcome.steps.2`
// all name the same thing the editor knows as `assessments.checkIn.formId` and
// `welcome.steps[2]`. A server that spells the assessments fields in snake_case
// (`check_in.form_id`) names the same fields too.
const CONTRACT_NAMES: Record<string, string> = {
  check_in: 'checkIn',
  form_id: 'formId',
  max_attempts: 'maxAttempts',
  time_limit_min: 'timeLimitMin',
  pass_percent: 'passPercent',
  pass_operator: 'passOperator',
}

export const normalizePath = (path: string): string =>
  path
    .replace(/^(?:body\.)?(?:settings\.)?/, '')
    .replace(
      /(?<=^|\.)[a-z]+(?:_[a-z]+)+(?=\.|$)/g,
      (segment) => CONTRACT_NAMES[segment] ?? segment
    )
    .replace(/\.(\d+)(?=\.|$)/g, '[$1]')
    .replace(/^\[\d+\]/, '')

// The field itself first, then each enclosing one: the editor focuses the most
// specific control it has.
export const pathCandidates = (path: string): string[] => {
  const parts = normalizePath(path).match(/[^.[\]]+|\[\d+\]/g) ?? []
  const out: string[] = []
  for (let end = parts.length; end > 0; end -= 1) {
    out.push(
      parts
        .slice(0, end)
        .reduce(
          (acc, part) => (part.startsWith('[') ? acc + part : acc ? `${acc}.${part}` : part),
          ''
        )
    )
  }
  return out
}

export const tabFor = (path: string): StudioTab | null => {
  const root = normalizePath(path).split(/[.[]/)[0]
  if (root === 'trainer' || root === 'assessments') return 'training'
  if (root === 'welcome') return 'welcome'
  return null
}

export const stepIndexOf = (path: string): number | null => {
  const match = /^welcome\.steps\[(\d+)\]/.exec(normalizePath(path))
  return match ? Number(match[1]) : null
}

const asIssue = (value: unknown): SettingsIssue | null => {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  if (typeof raw.path !== 'string' || raw.path === '') return null
  const key =
    typeof raw.message_key === 'string'
      ? raw.message_key
      : typeof raw.messageKey === 'string'
        ? raw.messageKey
        : typeof raw.rule === 'string'
          ? raw.rule
          : 'unknown'
  return {
    path: normalizePath(raw.path),
    rule: typeof raw.rule === 'string' ? raw.rule : key,
    messageKey: key,
  }
}

export const toIssues = (value: unknown): SettingsIssue[] =>
  Array.isArray(value)
    ? value.map(asIssue).filter((issue): issue is SettingsIssue => issue !== null)
    : []

// The failing fields of a 422, or null when the error is not that kind (so the
// caller falls back to the one-line description).
export const issuesFromError = (error: unknown): SettingsIssue[] | null => {
  if (!(error instanceof ApiError) || error.status !== 422) return null
  const issues = toIssues(error.detail.errors)
  return issues.length > 0 ? issues : null
}

export const warningsOf = (saved: unknown): SettingsIssue[] =>
  saved && typeof saved === 'object' ? toIssues((saved as { warnings?: unknown }).warnings) : []

// ---- Words -------------------------------------------------------------------------

export interface IssueCopy {
  sections: {
    trainer: string
    assessments: string
    check_in: string
    final: string
    pass: string
    exemption: string
    welcome: string
    step: (position: number, title: string) => string
    other: string
  }
  messages: Record<string, string>
  warningMessages: Record<string, string>
  unknown: (key: string) => string
}

// The part of the settings an issue is about, in the author's words.
export const sectionLabel = (
  path: string,
  copy: IssueCopy,
  stepTitle?: (index: number) => string | undefined
): string => {
  const normal = normalizePath(path)
  const step = stepIndexOf(normal)
  if (step !== null) return copy.sections.step(step + 1, stepTitle?.(step) ?? '')
  if (normal.startsWith('assessments.checkIn')) return copy.sections.check_in
  if (normal.startsWith('assessments.final')) return copy.sections.final
  if (/^assessments\.pass(Percent|Operator)/.test(normal)) return copy.sections.pass
  if (normal.startsWith('assessments.exemption')) return copy.sections.exemption
  if (normal.startsWith('assessments')) return copy.sections.assessments
  if (normal.startsWith('trainer')) return copy.sections.trainer
  if (normal.startsWith('welcome')) return copy.sections.welcome
  return copy.sections.other
}

export const issueMessage = (issue: SettingsIssue, copy: IssueCopy): string =>
  copy.messages[issue.messageKey] ?? copy.messages[issue.rule] ?? copy.unknown(issue.messageKey)

// "Evaluación de entrada: el formulario seleccionado no existe".
export const describeIssue = (
  issue: SettingsIssue,
  copy: IssueCopy,
  stepTitle?: (index: number) => string | undefined
): string => `${sectionLabel(issue.path, copy, stepTitle)}: ${issueMessage(issue, copy)}`

// A warning that has its own sentence says it alone; any other is labelled like an error.
export const describeWarning = (
  issue: SettingsIssue,
  copy: IssueCopy,
  stepTitle?: (index: number) => string | undefined
): string => copy.warningMessages[issue.messageKey] ?? describeIssue(issue, copy, stepTitle)

// ---- Before the request ------------------------------------------------------------

// What the server would refuse, found here so the author hears it before the request:
// a check-in step needs the assessments switched on and a form. Same shape as the
// server's errors, so one list shows both.
export const checkTrainingSettings = (settings: MapSettings): SettingsIssue[] => {
  const issues: SettingsIssue[] = []
  const assessments = assessmentsOf(settings)
  const steps = settings.welcome?.steps ?? []
  const stepIndex = steps.findIndex((step) => step.type === 'assessment')
  if (stepIndex !== -1 && !assessments.enabled)
    issues.push({
      path: 'assessments.enabled',
      rule: 'required_by_check_in_step',
      messageKey: 'assessments_disabled',
    })
  if ((stepIndex !== -1 || assessments.enabled) && assessments.checkIn.formId.trim() === '')
    issues.push({
      path: 'assessments.checkIn.formId',
      rule: 'required',
      messageKey: 'form_required',
    })
  if (assessments.enabled && assessments.final.formId.trim() === '')
    issues.push({
      path: 'assessments.final.formId',
      rule: 'required',
      messageKey: 'form_required',
    })
  return issues
}

// ---- Keeping the list honest -------------------------------------------------------

const valueAt = (root: unknown, path: string): unknown => {
  let current: unknown = root
  for (const part of path.match(/[^.[\]]+/g) ?? []) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

// Once the author changes a field, its error is stale: drop it (the others stay until
// the next save).
export const pruneIssues = (
  issues: readonly SettingsIssue[],
  before: MapSettings,
  after: MapSettings
): SettingsIssue[] =>
  issues.filter((issue) => {
    const a = JSON.stringify(valueAt(before, issue.path) ?? null)
    const b = JSON.stringify(valueAt(after, issue.path) ?? null)
    return a === b
  })
