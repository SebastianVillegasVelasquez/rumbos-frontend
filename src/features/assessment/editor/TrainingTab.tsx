import { useId } from 'react'
import { AlertCircle } from 'lucide-react'
import { es } from '../../../i18n/es.ts'
import type { MapSettings, TrainerLevel } from '../../course-map/data/types.ts'
import { issueMessage, normalizePath, type SettingsIssue } from './settingsIssues.ts'
import {
  ALL_LEVELS,
  LIMITS,
  assessmentsOf,
  levelHasContent,
  setPolicy,
  setRules,
  setTrainer,
  trainerOf,
  type Purpose,
} from './trainingForm.ts'

const text = es.studio.training
const labelClass = 'text-xs font-bold uppercase tracking-wide text-ink-soft'
const checkboxClass = 'h-5 w-5 shrink-0 accent-primary'
const fieldClass =
  'border-soft min-h-[44px] w-full rounded-md bg-surface px-3 py-2 text-sm font-semibold text-ink'
const hintClass = 'text-xs font-semibold text-ink-soft'
// A field with a problem is marked by shape as well as color: a thicker ring, the
// icon and the message under it (and aria-invalid for screen readers).
const invalidClass = 'ring-2 ring-danger'

type Issues = readonly SettingsIssue[]

// What the server (or the editor's own check) said about this field, if anything.
const messageAt = (issues: Issues, path: string): string | null => {
  const issue = issues.find((candidate) => normalizePath(candidate.path) === path)
  return issue ? issueMessage(issue, text.issues) : null
}

// The control's own attributes when it has a problem. `data-field-path` is how the
// studio finds it to move the focus.
const fieldProps = (path: string, error: string | null, errorId: string) => ({
  'data-field-path': path,
  'aria-invalid': error !== null ? true : undefined,
  'aria-describedby': error !== null ? errorId : undefined,
})

const FieldError = ({ id, message }: { id: string; message: string | null }) =>
  message ? (
    <p id={id} className="flex items-start gap-1.5 text-xs font-bold text-danger">
      <AlertCircle size={14} strokeWidth={2.5} aria-hidden className="mt-0.5 shrink-0" />
      <span>
        <span className="sr-only">{text.fieldError}: </span>
        {message}
      </span>
    </p>
  ) : null

// A switch that always says its state in words (never by position or color alone).
const Toggle = ({
  label,
  checked,
  onChange,
  path,
  issues,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
  path: string
  issues: Issues
}) => {
  const errorId = useId()
  const error = messageAt(issues, path)
  return (
    <div className="space-y-1">
      <label
        className={`flex min-h-[44px] items-start gap-3 rounded-md text-sm font-bold text-ink ${error ? invalidClass : ''}`}
      >
        <input
          type="checkbox"
          role="switch"
          className={`${checkboxClass} mt-0.5`}
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          {...fieldProps(path, error, errorId)}
        />
        <span className="flex-1">{label}</span>
        <span className="text-xs font-extrabold text-ink-soft">{checked ? text.on : text.off}</span>
      </label>
      <FieldError id={errorId} message={error} />
    </div>
  )
}

const NumberField = ({
  label,
  hint,
  value,
  min,
  max,
  onChange,
  path,
  issues,
}: {
  label: string
  hint?: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  path: string
  issues: Issues
}) => {
  const id = useId()
  const errorId = useId()
  const error = messageAt(issues, path)
  return (
    <div className="space-y-1">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        className={`${fieldClass} ${error ? invalidClass : ''}`}
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(event.target.valueAsNumber)}
        {...fieldProps(path, error, errorId)}
      />
      <FieldError id={errorId} message={error} />
      {hint && <p className={hintClass}>{hint}</p>}
    </div>
  )
}

const PurposeRules = ({
  purpose,
  settings,
  onChange,
  issues,
}: {
  purpose: Purpose
  settings: MapSettings
  onChange: (settings: MapSettings) => void
  issues: Issues
}) => {
  const rules = assessmentsOf(settings)[purpose]
  const base = `assessments.${purpose}`
  const formId = useId()
  const formErrorId = useId()
  const sectionErrorId = useId()
  const formError = messageAt(issues, `${base}.form_id`)
  const sectionError = messageAt(issues, base)
  return (
    <fieldset
      tabIndex={-1}
      data-field-path={base}
      aria-describedby={sectionError ? sectionErrorId : undefined}
      className={`space-y-3 rounded-md border-hair p-3 outline-none ${sectionError ? invalidClass : ''}`}
    >
      <legend className="px-1 text-sm font-extrabold text-ink">
        {purpose === 'check_in' ? text.checkIn : text.final}
      </legend>
      <FieldError id={sectionErrorId} message={sectionError} />
      <div className="space-y-1">
        <label htmlFor={formId} className={labelClass}>
          {text.formId}
        </label>
        <input
          id={formId}
          type="text"
          autoComplete="off"
          spellCheck={false}
          maxLength={LIMITS.formIdMax}
          className={`${fieldClass} ${formError ? invalidClass : ''}`}
          value={rules.form_id}
          onChange={(event) =>
            onChange(setRules(settings, purpose, { form_id: event.target.value }))
          }
          {...fieldProps(`${base}.form_id`, formError, formErrorId)}
        />
        <FieldError id={formErrorId} message={formError} />
        <p className={hintClass}>{text.formIdHint}</p>
      </div>
      <NumberField
        label={text.attempts}
        value={rules.max_attempts}
        min={LIMITS.attempts.min}
        max={LIMITS.attempts.max}
        path={`${base}.max_attempts`}
        issues={issues}
        onChange={(value) => onChange(setRules(settings, purpose, { max_attempts: value }))}
      />
      <NumberField
        label={text.minutes}
        hint={text.minutesHint}
        value={rules.time_limit_min}
        min={LIMITS.minutes.min}
        max={LIMITS.minutes.max}
        path={`${base}.time_limit_min`}
        issues={issues}
        onChange={(value) => onChange(setRules(settings, purpose, { time_limit_min: value }))}
      />
    </fieldset>
  )
}

// The editor's "Entrenamiento y evaluación" panel. Saves through the studio's own
// Save button (the settings endpoint and its versioning), so nothing here talks to
// the server. The level, language and policy are the course's, never the student's.
// `issues` are the fields a save was refused for: each is marked and says why.
export const TrainingTab = ({
  settings,
  onChange,
  issues = [],
}: {
  settings: MapSettings
  onChange: (settings: MapSettings) => void
  issues?: Issues
}) => {
  const trainer = trainerOf(settings)
  const assessments = assessmentsOf(settings)
  const ids = { level: useId(), levelError: useId(), operator: useId(), operatorError: useId() }
  const levelError = messageAt(issues, 'trainer.level')
  const operatorError = messageAt(issues, 'assessments.pass_operator')
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="font-heading text-base font-extrabold text-ink">{text.title}</h3>
        <p className={hintClass}>{text.intro}</p>
      </div>

      <section className="space-y-3" aria-labelledby={`${ids.level}-t`}>
        <h4 id={`${ids.level}-t`} className="text-sm font-extrabold text-ink">
          {text.trainerTitle}
        </h4>
        <Toggle
          label={text.trainerSwitch}
          checked={trainer.enabled}
          path="trainer.enabled"
          issues={issues}
          onChange={(enabled) => onChange(setTrainer(settings, { enabled }))}
        />
        <div className="space-y-1">
          <span className={labelClass}>{text.language}</span>
          <p className={`${fieldClass} flex items-center`}>{text.languageEnglish}</p>
        </div>
        <div className="space-y-1">
          <label htmlFor={ids.level} className={labelClass}>
            {text.level}
          </label>
          <select
            id={ids.level}
            className={`${fieldClass} ${levelError ? invalidClass : ''}`}
            value={trainer.level}
            onChange={(event) =>
              onChange(setTrainer(settings, { level: event.target.value as TrainerLevel }))
            }
            {...fieldProps('trainer.level', levelError, ids.levelError)}
          >
            {ALL_LEVELS.map((level) => {
              const available = levelHasContent(trainer.language, level)
              return (
                <option key={level} value={level} disabled={!available}>
                  {available ? level : `${level} · ${text.noContent}`}
                </option>
              )
            })}
          </select>
          <FieldError id={ids.levelError} message={levelError} />
          <p className={hintClass}>{text.definedByCourse}</p>
        </div>
      </section>

      <section className="space-y-3">
        <h4 className="text-sm font-extrabold text-ink">{text.assessmentsTitle}</h4>
        <Toggle
          label={text.assessmentsSwitch}
          checked={assessments.enabled}
          path="assessments.enabled"
          issues={issues}
          onChange={(enabled) => onChange(setPolicy(settings, { enabled }))}
        />
        <PurposeRules purpose="check_in" settings={settings} onChange={onChange} issues={issues} />
        <PurposeRules purpose="final" settings={settings} onChange={onChange} issues={issues} />

        <NumberField
          label={text.passPercent}
          value={assessments.pass_percent}
          min={LIMITS.percent.min}
          max={LIMITS.percent.max}
          path="assessments.pass_percent"
          issues={issues}
          onChange={(value) => onChange(setPolicy(settings, { pass_percent: value }))}
        />
        <div className="space-y-1">
          <label htmlFor={ids.operator} className={labelClass}>
            {text.operator}
          </label>
          <select
            id={ids.operator}
            className={`${fieldClass} ${operatorError ? invalidClass : ''}`}
            value={assessments.pass_operator}
            onChange={(event) =>
              onChange(setPolicy(settings, { pass_operator: event.target.value as 'gt' | 'gte' }))
            }
            {...fieldProps('assessments.pass_operator', operatorError, ids.operatorError)}
          >
            <option value="gt">{text.operators.gt}</option>
            <option value="gte">{text.operators.gte}</option>
          </select>
          <FieldError id={ids.operatorError} message={operatorError} />
          <p className={hintClass}>
            {text.rule(assessments.pass_percent, assessments.pass_operator)}
          </p>
        </div>

        <Toggle
          label={text.exemption}
          checked={assessments.exemption.enabled}
          path="assessments.exemption.enabled"
          issues={issues}
          onChange={(exemption) => onChange(setPolicy(settings, { exemption }))}
        />
        {assessments.exemption.enabled && (
          <p role="note" className="rounded-md bg-sun-tint p-3 text-xs font-bold text-sun-dark">
            {text.exemptionWarning}
          </p>
        )}
        <p className={hintClass}>{text.previewNote}</p>
      </section>
    </div>
  )
}
