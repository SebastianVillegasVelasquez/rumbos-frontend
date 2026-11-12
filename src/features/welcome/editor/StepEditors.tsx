import { useId, useRef, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { Button } from '../../../components/ui/Button.tsx'
import { Input } from '../../../components/ui/Input.tsx'
import { Select } from '../../../components/ui/Select.tsx'
import { es } from '../../../i18n/es.ts'
import { parseVideoInput } from '../../content/video.ts'
import { useAssets, useCreateAsset } from '../../course-map/data/queries.ts'
import { checkDocumentBasics, DOCUMENT_MIME } from '../../course-map/data/assetLimits.ts'
import {
  FLOW_LIMITS,
  type Activity,
  type AssetListParams,
  type WelcomeHtmlStep,
  type WelcomePdfStep,
  type WelcomeQuizStep,
  type WelcomeStep,
  type WelcomeMessageStep,
  type WelcomeVideoStep,
} from '../../course-map/data/types.ts'
import { API_BASE_URL } from '../../course-map/data/client.ts'
import { assetsOrigin, htmlStepFrameAttributes } from '../flow/htmlStepDocument.ts'
import { documentErrorKey, type DocumentErrorKey } from './documentErrors.ts'
import { applyTemplate, type TemplateId } from './flowEdit.ts'

const text = es.studio.flow
const labelClass = 'text-xs font-bold uppercase tracking-wide text-ink-soft'
const checkboxClass = 'h-5 w-5 shrink-0 accent-primary'
const areaClass =
  'border-soft min-h-[88px] w-full rounded-md bg-surface px-3 py-2 text-sm font-semibold text-ink'
const hintClass = 'text-xs font-semibold text-ink-soft'

export interface EditorProps<T extends WelcomeStep> {
  step: T
  onChange: (patch: Partial<T>) => void
  // Problems the validation found in this step, by field.
  problems: ReadonlySet<string>
}

const Field = ({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  children: React.ReactNode
}) => (
  <div className="space-y-1">
    <label htmlFor={htmlFor} className={labelClass}>
      {label}
    </label>
    {children}
    {hint && <p className={hintClass}>{hint}</p>}
  </div>
)

// ---- welcome ---------------------------------------------------------------------

export const WelcomeEditor = ({ step, onChange }: EditorProps<WelcomeMessageStep>) => {
  const ids = { message: useId(), button: useId() }
  return (
    <>
      <Field label={text.welcome.message} htmlFor={ids.message}>
        <textarea
          id={ids.message}
          rows={3}
          value={step.message ?? ''}
          onChange={(event) => onChange({ message: event.target.value || null })}
          className={areaClass}
        />
      </Field>
      <Field label={text.welcome.buttonLabel} htmlFor={ids.button} hint={text.welcome.buttonHint}>
        <Input
          id={ids.button}
          density="compact"
          value={step.buttonLabel ?? ''}
          onChange={(event) => onChange({ buttonLabel: event.target.value || null })}
        />
      </Field>
    </>
  )
}

// ---- video -----------------------------------------------------------------------

const linkOf = (video: WelcomeVideoStep['video']) =>
  video.videoId === ''
    ? ''
    : video.provider === 'youtube'
      ? `https://youtu.be/${video.videoId}`
      : `https://vimeo.com/${video.videoId}`

export const VideoEditor = ({ step, onChange, problems }: EditorProps<WelcomeVideoStep>) => {
  const id = useId()
  const [typed, setTyped] = useState(() => linkOf(step.video))
  const parsed = typed.trim() === '' ? null : parseVideoInput(typed)
  const invalid = problems.has('video') || (typed.trim() !== '' && parsed === null)
  return (
    <>
      <Field label={text.video.link} htmlFor={id}>
        <Input
          id={id}
          density="compact"
          inputMode="url"
          value={typed}
          aria-invalid={invalid}
          aria-describedby={`${id}-help`}
          onChange={(event) => {
            setTyped(event.target.value)
            const next = parseVideoInput(event.target.value)
            if (next) onChange({ video: next })
            else if (event.target.value.trim() === '')
              onChange({ video: { provider: 'youtube', videoId: '' } })
          }}
        />
        <p
          id={`${id}-help`}
          role={invalid ? 'alert' : undefined}
          className={`text-xs font-semibold ${invalid ? 'text-danger' : 'text-ink-soft'}`}
        >
          {invalid
            ? text.video.invalid
            : parsed
              ? text.video.found(es.welcome.providers[parsed.provider])
              : text.video.hint}
        </p>
      </Field>
      <label className="flex min-h-[44px] items-start gap-2 text-sm font-bold text-ink">
        <input
          className={`${checkboxClass} mt-0.5`}
          type="checkbox"
          checked={step.allowFallback}
          onChange={(event) => onChange({ allowFallback: event.target.checked })}
        />
        <span>
          {text.video.allowFallback}
          <span className="block text-xs font-semibold text-ink-soft">
            {text.video.allowFallbackHint}
          </span>
        </span>
      </label>
      {step.allowFallback && (
        <p role="note" className="border-soft rounded-md bg-surface p-2 text-xs font-bold text-ink">
          {text.video.allowFallbackWarning}
        </p>
      )}
    </>
  )
}

// ---- html ------------------------------------------------------------------------

const byteLength = (value: string) => new TextEncoder().encode(value).length
const kb = (value: string) => Math.ceil(byteLength(value) / 1024)

const AckFields = ({
  step,
  onChange,
  labels,
}: {
  step: WelcomeHtmlStep | WelcomePdfStep
  onChange: (patch: { ack?: { label: string } | null; minSeconds?: number }) => void
  labels: { ack: string; ackLabel: string; minSeconds: string }
}) => {
  const ids = { label: useId(), seconds: useId() }
  return (
    <>
      <label className="flex min-h-[44px] items-center gap-2 text-sm font-bold text-ink">
        <input
          className={checkboxClass}
          type="checkbox"
          checked={step.ack !== null}
          onChange={(event) => onChange({ ack: event.target.checked ? { label: '' } : null })}
        />
        {labels.ack}
      </label>
      {step.ack && (
        <Field label={labels.ackLabel} htmlFor={ids.label}>
          <Input
            id={ids.label}
            density="compact"
            value={step.ack.label}
            maxLength={160}
            onChange={(event) => onChange({ ack: { label: event.target.value } })}
          />
        </Field>
      )}
      <Field label={labels.minSeconds} htmlFor={ids.seconds}>
        <Input
          id={ids.seconds}
          density="compact"
          type="number"
          inputMode="numeric"
          min={0}
          max={FLOW_LIMITS.minSecondsMax}
          value={step.minSeconds}
          onChange={(event) =>
            onChange({
              minSeconds: Math.max(
                0,
                Math.min(FLOW_LIMITS.minSecondsMax, Math.floor(Number(event.target.value) || 0))
              ),
            })
          }
        />
      </Field>
    </>
  )
}

export const HtmlEditor = ({ step, onChange, problems }: EditorProps<WelcomeHtmlStep>) => {
  const ids = { template: useId(), html: useId(), css: useId() }
  const attributes = htmlStepFrameAttributes({
    html: step.html,
    css: step.css,
    origin: assetsOrigin(API_BASE_URL, window.location.origin),
  })
  const [template, setTemplate] = useState<TemplateId | ''>('')
  return (
    <>
      <Field label={text.html.template} htmlFor={ids.template} hint={text.html.templateReplace}>
        <Select
          id={ids.template}
          value={template}
          onChange={(event) => {
            const id = event.target.value as TemplateId | ''
            setTemplate('')
            if (id) onChange(applyTemplate(step, id))
          }}
        >
          <option value="">{text.html.templateNone}</option>
          {(Object.keys(text.html.templates) as TemplateId[]).map((id) => (
            <option key={id} value={id}>
              {text.html.templates[id]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={text.html.html} htmlFor={ids.html} hint={text.html.htmlHint}>
        <textarea
          id={ids.html}
          rows={6}
          spellCheck={false}
          value={step.html}
          aria-invalid={problems.has('html')}
          onChange={(event) => onChange({ html: event.target.value })}
          className={`${areaClass} font-mono`}
        />
        <p className={hintClass}>
          {text.html.sizeUsed(kb(step.html), FLOW_LIMITS.htmlMaxBytes / 1024)}
        </p>
      </Field>
      <Field label={text.html.css} htmlFor={ids.css}>
        <textarea
          id={ids.css}
          rows={3}
          spellCheck={false}
          value={step.css ?? ''}
          aria-invalid={problems.has('css')}
          onChange={(event) =>
            onChange({ css: event.target.value === '' ? null : event.target.value })
          }
          className={`${areaClass} font-mono`}
        />
      </Field>
      <AckFields
        step={step}
        onChange={onChange}
        labels={{
          ack: text.html.ack,
          ackLabel: text.html.ackLabel,
          minSeconds: text.html.minSeconds,
        }}
      />
      <div className="space-y-1">
        <span className={labelClass}>{text.html.preview}</span>
        <iframe
          title={text.html.preview}
          sandbox={attributes.sandbox}
          srcDoc={attributes.srcDoc}
          referrerPolicy={attributes.referrerPolicy}
          {...({ csp: attributes.csp } as object)}
          className="border-soft h-48 w-full rounded-md bg-white"
        />
        <p className={hintClass}>{text.html.sandboxNote}</p>
      </div>
    </>
  )
}

// ---- pdf -------------------------------------------------------------------------

const DOCUMENT_PARAMS: AssetListParams = { kind: 'document', scope: 'tenant', limit: 100 }

export const PdfEditor = ({ step, onChange, problems }: EditorProps<WelcomePdfStep>) => {
  const ids = { choose: useId(), rights: useId() }
  const library = useAssets(DOCUMENT_PARAMS)
  const create = useCreateAsset()
  const [rights, setRights] = useState(false)
  const [error, setError] = useState<DocumentErrorKey | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const items = library.data?.items ?? []
  const current = items.find((item) => item.id === step.assetId)
  const missing = problems.has('assetId') || (current !== undefined && current.available === false)

  const upload = (file: File) => {
    setError(null)
    const basics = checkDocumentBasics(file)
    if (basics) {
      setError(basics === 'tooLarge' ? 'asset_too_large' : 'not_pdf')
      return
    }
    if (!rights) {
      setError('rights')
      return
    }
    create.mutate(
      { file, kind: 'document', rightsDeclared: true },
      {
        onSuccess: ({ asset }) => onChange({ assetId: asset.id }),
        onError: (failure) => setError(documentErrorKey(failure)),
      }
    )
  }

  return (
    <>
      <Field label={text.pdf.choose} htmlFor={ids.choose}>
        <Select
          id={ids.choose}
          value={step.assetId}
          aria-invalid={missing}
          onChange={(event) => onChange({ assetId: event.target.value })}
        >
          <option value="">{text.pdf.none}</option>
          {step.assetId !== '' && !current && <option value={step.assetId}>{step.assetId}</option>}
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </Select>
      </Field>
      {missing && (
        <p role="alert" className="text-xs font-bold text-danger">
          {text.pdf.missing}
        </p>
      )}
      <div className="border-soft space-y-2 rounded-md p-3">
        <label
          htmlFor={ids.rights}
          className="flex min-h-[44px] items-start gap-2 text-sm font-bold text-ink"
        >
          <input
            id={ids.rights}
            className={`${checkboxClass} mt-0.5`}
            type="checkbox"
            checked={rights}
            onChange={(event) => setRights(event.target.checked)}
          />
          {text.pdf.rights}
        </label>
        <p className={hintClass}>{text.pdf.confidentiality}</p>
        <input
          ref={fileRef}
          type="file"
          accept={DOCUMENT_MIME}
          className="sr-only"
          aria-label={text.pdf.upload}
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) upload(file)
          }}
        />
        <Button
          size="sm"
          variant="secondary"
          disabled={create.isPending}
          onClick={() => fileRef.current?.click()}
        >
          {create.isPending ? (
            <Loader2 size={16} className="animate-spin" aria-hidden />
          ) : (
            <Upload size={16} strokeWidth={2.5} aria-hidden />
          )}
          {create.isPending ? text.pdf.uploading : text.pdf.upload}
        </Button>
        {error && (
          <p role="alert" className="text-xs font-bold text-danger">
            {text.pdf.errors[error]}
          </p>
        )}
      </div>
      <AckFields
        step={step}
        onChange={onChange}
        labels={{
          ack: text.pdf.ack,
          ackLabel: text.pdf.ackLabel,
          minSeconds: text.pdf.minSeconds,
        }}
      />
    </>
  )
}

// ---- quiz ------------------------------------------------------------------------

export const QuizEditor = ({
  step,
  onChange,
  activities,
}: EditorProps<WelcomeQuizStep> & { activities: readonly Activity[] }) => {
  const ids = { quiz: useId(), intro: useId(), above: useId(), below: useId() }
  const quizzes = activities.filter((activity) => activity.modname === 'quiz')
  return (
    <>
      <Field
        label={text.quiz.activity}
        htmlFor={ids.quiz}
        hint={step.cmid === null ? text.quiz.unlinkedHint : undefined}
      >
        <Select
          id={ids.quiz}
          value={step.cmid === null ? '' : String(step.cmid)}
          onChange={(event) =>
            onChange({ cmid: event.target.value === '' ? null : Number(event.target.value) })
          }
        >
          <option value="">{text.quiz.unlinked}</option>
          {quizzes.map((quiz) => (
            <option key={quiz.activityId} value={quiz.activityId}>
              {quiz.name}
            </option>
          ))}
        </Select>
      </Field>
      {quizzes.length === 0 && <p className={hintClass}>{text.quiz.none}</p>}
      <p role="note" className="border-soft rounded-md bg-surface p-2 text-xs font-bold text-ink">
        {text.quiz.secureWindow}
      </p>
      <Field label={text.quiz.intro} htmlFor={ids.intro}>
        <textarea
          id={ids.intro}
          rows={2}
          value={step.intro ?? ''}
          onChange={(event) => onChange({ intro: event.target.value || null })}
          className={areaClass}
        />
      </Field>
      <Field label={text.quiz.outcomeAbove} htmlFor={ids.above}>
        <Input
          id={ids.above}
          density="compact"
          value={step.outcomeAbove ?? ''}
          onChange={(event) => onChange({ outcomeAbove: event.target.value || null })}
        />
      </Field>
      <Field label={text.quiz.outcomeBelow} htmlFor={ids.below} hint={text.quiz.outcomeHint}>
        <Input
          id={ids.below}
          density="compact"
          value={step.outcomeBelow ?? ''}
          onChange={(event) => onChange({ outcomeBelow: event.target.value || null })}
        />
      </Field>
    </>
  )
}
