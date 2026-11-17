import { useId } from 'react'
import { es } from '../../../i18n/es.ts'
import type { MapSettings, TrainerLevel } from '../../course-map/data/types.ts'
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

// A switch that always says its state in words (never by position or color alone).
const Toggle = ({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) => (
  <label className="flex min-h-[44px] items-start gap-3 text-sm font-bold text-ink">
    <input
      type="checkbox"
      role="switch"
      className={`${checkboxClass} mt-0.5`}
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
    />
    <span className="flex-1">{label}</span>
    <span className="text-xs font-extrabold text-ink-soft">{checked ? text.on : text.off}</span>
  </label>
)

const NumberField = ({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  hint?: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) => {
  const id = useId()
  return (
    <div className="space-y-1">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        className={fieldClass}
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(event.target.valueAsNumber)}
      />
      {hint && <p className={hintClass}>{hint}</p>}
    </div>
  )
}

const PurposeRules = ({
  purpose,
  settings,
  onChange,
}: {
  purpose: Purpose
  settings: MapSettings
  onChange: (settings: MapSettings) => void
}) => {
  const rules = assessmentsOf(settings)[purpose]
  return (
    <fieldset className="space-y-3 rounded-md border-hair p-3">
      <legend className="px-1 text-sm font-extrabold text-ink">
        {purpose === 'check_in' ? text.checkIn : text.final}
      </legend>
      <NumberField
        label={text.attempts}
        value={rules.max_attempts}
        min={LIMITS.attempts.min}
        max={LIMITS.attempts.max}
        onChange={(value) => onChange(setRules(settings, purpose, { max_attempts: value }))}
      />
      <NumberField
        label={text.minutes}
        hint={text.minutesHint}
        value={rules.time_limit_min}
        min={LIMITS.minutes.min}
        max={LIMITS.minutes.max}
        onChange={(value) => onChange(setRules(settings, purpose, { time_limit_min: value }))}
      />
    </fieldset>
  )
}

// The editor's "Entrenamiento y evaluación" panel. Saves through the studio's own
// Save button (the settings endpoint and its versioning), so nothing here talks to
// the server. The level, language and policy are the course's, never the student's.
export const TrainingTab = ({
  settings,
  onChange,
}: {
  settings: MapSettings
  onChange: (settings: MapSettings) => void
}) => {
  const trainer = trainerOf(settings)
  const assessments = assessmentsOf(settings)
  const ids = { level: useId(), operator: useId() }
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
            className={fieldClass}
            value={trainer.level}
            onChange={(event) =>
              onChange(setTrainer(settings, { level: event.target.value as TrainerLevel }))
            }
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
          <p className={hintClass}>{text.definedByCourse}</p>
        </div>
      </section>

      <section className="space-y-3">
        <h4 className="text-sm font-extrabold text-ink">{text.assessmentsTitle}</h4>
        <Toggle
          label={text.assessmentsSwitch}
          checked={assessments.enabled}
          onChange={(enabled) => onChange(setPolicy(settings, { enabled }))}
        />
        <PurposeRules purpose="check_in" settings={settings} onChange={onChange} />
        <PurposeRules purpose="final" settings={settings} onChange={onChange} />

        <NumberField
          label={text.passPercent}
          value={assessments.pass_percent}
          min={LIMITS.percent.min}
          max={LIMITS.percent.max}
          onChange={(value) => onChange(setPolicy(settings, { pass_percent: value }))}
        />
        <div className="space-y-1">
          <label htmlFor={ids.operator} className={labelClass}>
            {text.operator}
          </label>
          <select
            id={ids.operator}
            className={fieldClass}
            value={assessments.pass_operator}
            onChange={(event) =>
              onChange(setPolicy(settings, { pass_operator: event.target.value as 'gt' | 'gte' }))
            }
          >
            <option value="gt">{text.operators.gt}</option>
            <option value="gte">{text.operators.gte}</option>
          </select>
          <p className={hintClass}>
            {text.rule(assessments.pass_percent, assessments.pass_operator)}
          </p>
        </div>

        <Toggle
          label={text.exemption}
          checked={assessments.exemption.enabled}
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
