import { useMemo, useState, useSyncExternalStore } from 'react'
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { Button, IconButton } from '../../../components/ui/Button.tsx'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog.tsx'
import { Input } from '../../../components/ui/Input.tsx'
import { SegmentedControl } from '../../../components/ui/SegmentedControl.tsx'
import { es } from '../../../i18n/es.ts'
import { useAssets } from '../../course-map/data/queries.ts'
import {
  type Activity,
  type FlowKey,
  type AssetListParams,
  type MapSettings,
  type MapWelcome,
  type WelcomeDocument,
  type WelcomeShow,
  type WelcomeStep,
  type WelcomeStepType,
} from '../../course-map/data/types.ts'
import { useHostCourseName } from '../../embed/hostCourse.ts'
import { useEmbed } from '../../embed/EmbedContext.ts'
import { getHostFlowProgress, subscribeHostFlow } from '../../embed/hostFlow.ts'
import { LazyWelcomeFlow } from '../flow/LazyWelcomeFlow.tsx'
import {
  STEP_TYPES_BY_FLOW,
  convertLegacyToSteps,
  validateFlow,
  type FlowProblem,
} from '../flow/flowSteps.ts'
import { resolveWelcome } from '../welcome.ts'
import {
  addStep,
  askAgain,
  canAdd,
  canMove,
  createStep,
  deleteStep,
  duplicateStep,
  moveStep,
  updateStep,
} from './flowEdit.ts'
import { flowFlags } from './flowFlags.ts'
import {
  issueMessage,
  stepIndexOf,
  type SettingsIssue,
} from '../../assessment/editor/settingsIssues.ts'
import { assessmentsOf, enableAssessments } from '../../assessment/editor/trainingForm.ts'
import {
  AssessmentEditor,
  HtmlEditor,
  PdfEditor,
  QuizEditor,
  VideoEditor,
  WelcomeEditor,
} from './StepEditors.tsx'
import { WelcomeTab } from './WelcomeTab.tsx'

const flowText = es.studio.flow
const text = flowText
// The label of a step's kind; the final exam is not the check-in.
const kindLabel = (step: WelcomeStep) =>
  step.type === 'assessment' && step.purpose === 'final'
    ? es.studio.closingFlow.types.assessment
    : text.types[step.type]
const checkboxClass = 'h-5 w-5 shrink-0 accent-primary'
const DOCUMENT_PARAMS: AssetListParams = { kind: 'document', scope: 'tenant', limit: 100 }

interface FlowTabProps {
  // Which guided flow this edits; the welcome flow when absent. Same editor, same steps.
  flowKey?: FlowKey
  settings: MapSettings
  onChange: (settings: MapSettings) => void
  mapId: string
  mapTitle: string
  imageUrl: string
  hasMusic: boolean
  activities: readonly Activity[]
  // The documents the saved steps use; undefined: the backend has no flows.
  documents: readonly WelcomeDocument[] | undefined
  // What the last save said was wrong with the steps (field-level 422).
  issues?: readonly SettingsIssue[]
}

// Which problems the validation found, by step position and field.
const problemsByStep = (problems: readonly FlowProblem[]) => {
  const byStep = new Map<number, Set<string>>()
  const general: FlowProblem[] = []
  for (const problem of problems) {
    const match = /^steps\[(\d+)\](?:\.(\w+))?$/.exec(problem.path)
    if (!match) {
      general.push(problem)
      continue
    }
    const index = Number(match[1])
    const set = byStep.get(index) ?? new Set<string>()
    set.add(match[2] ?? '')
    byStep.set(index, set)
  }
  return { byStep, general }
}

// The editor's "Flujo de bienvenida" tab. A map from before flows keeps the old
// form until the author converts it; the conversion turns the message and the
// video into steps and clears the old fields (the backend refuses both at once).
export const FlowTab = (props: FlowTabProps) => {
  const { settings, onChange, documents, flowKey = 'welcome' } = props
  const welcome = resolveWelcome(settings[flowKey])
  const labels = useMemo(
    () => ({
      welcomeTitle: es.welcome.defaultTitle,
      videoTitle: es.welcome.videoTitle,
    }),
    []
  )
  // The closing flow has no legacy form to convert from: it starts as an empty list.
  if (flowKey === 'closing')
    return (
      <StepsEditor
        {...props}
        documents={documents ?? []}
        welcome={{ ...welcome, steps: welcome.steps ?? [], show: 'always' }}
      />
    )
  // ASSUMPTION: a backend with flows always returns welcomeDocuments (an array).
  if (documents === undefined) return <WelcomeTab {...props} />
  if (!Array.isArray(welcome.steps))
    return (
      <div className="space-y-4">
        <WelcomeTab {...props} />
        <div className="border-soft space-y-2 rounded-md p-3">
          <h4 className="font-heading text-sm font-extrabold text-ink">{text.convertTitle}</h4>
          <p className="text-xs font-semibold text-ink-soft">{text.convertHint}</p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              onChange({ ...settings, welcome: convertLegacyToSteps(welcome, labels) })
            }
          >
            {text.convert}
          </Button>
        </div>
      </div>
    )
  return <StepsEditor {...props} documents={documents} welcome={welcome} />
}

const StepsEditor = ({
  settings,
  onChange,
  mapId,
  mapTitle,
  imageUrl,
  hasMusic,
  activities,
  documents,
  welcome,
  issues = [],
  flowKey = 'welcome',
}: FlowTabProps & { documents: readonly WelcomeDocument[]; welcome: MapWelcome }) => {
  // The words of the closing flow replace the welcome flow's where they differ.
  const text = useMemo(
    () =>
      flowKey === 'closing'
        ? {
            ...flowText,
            ...es.studio.closingFlow,
            types: { ...flowText.types, ...es.studio.closingFlow.types },
            newTitles: { ...flowText.newTitles, ...es.studio.closingFlow.newTitles },
          }
        : flowText,
    [flowKey]
  )
  const types = STEP_TYPES_BY_FLOW[flowKey]
  const steps = useMemo(() => welcome.steps ?? [], [welcome.steps])
  const courseName = useHostCourseName()
  const library = useAssets(DOCUMENT_PARAMS)
  const [open, setOpen] = useState<string | null>(null)
  const [removing, setRemoving] = useState<number | null>(null)
  const [refusal, setRefusal] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)
  // The step for which the assessments were switched on automatically, to say so.
  const [autoEnabledFor, setAutoEnabledFor] = useState<string | null>(null)
  const assessments = assessmentsOf(settings)

  const setSteps = (next: WelcomeStep[]) =>
    onChange({ ...settings, [flowKey]: { ...welcome, steps: next } })
  const patchWelcome = (patch: Partial<MapWelcome>) =>
    onChange({ ...settings, [flowKey]: { ...welcome, ...patch } })

  const availableDocuments = useMemo(() => {
    if (!library.data) return undefined
    return new Set([
      ...library.data.items.filter((item) => item.available !== false).map((item) => item.id),
      ...documents.filter((item) => item.available).map((item) => item.assetId),
    ])
  }, [library.data, documents])
  const problems = useMemo(
    () => validateFlow({ ...welcome, steps }, { availableDocuments, flowKey }),
    [welcome, steps, availableDocuments, flowKey]
  )
  const { byStep, general } = problemsByStep(problems)
  const flags = flowFlags(steps, availableDocuments)

  const previewDocuments: WelcomeDocument[] = useMemo(() => {
    const known = new Map(documents.map((item) => [item.assetId, item]))
    for (const item of library.data?.items ?? [])
      if (!known.has(item.id))
        known.set(item.id, {
          assetId: item.id,
          url: item.url,
          title: item.title,
          pageCount: 0,
          bytes: item.bytes,
          available: item.available !== false,
        })
    return [...known.values()]
  }, [documents, library.data])

  const add = (type: WelcomeStepType) => {
    const refused = canAdd(steps, type)
    if (refused) {
      setRefusal(text.refusals[refused])
      return
    }
    setRefusal(null)
    const step = createStep(type, steps, text.newTitles, undefined, flowKey)
    const next = { ...settings, [flowKey]: { ...welcome, steps: addStep(steps, step) } }
    // The check-in cannot work with the assessments off: switch them on, and say so in
    // the step instead of letting the save fail later.
    if (type === 'assessment' && !assessments.enabled) {
      onChange(enableAssessments(next))
      setAutoEnabledFor(step.key)
    } else onChange(next)
    setOpen(step.key)
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-heading text-base font-extrabold text-ink">{text.title}</h3>
        <p className="text-xs font-semibold text-ink-soft">{text.intro}</p>
      </div>

      <label className="flex min-h-[44px] items-center gap-2 text-sm font-bold text-ink">
        <input
          className={checkboxClass}
          type="checkbox"
          checked={welcome.enabled}
          onChange={(event) => patchWelcome({ enabled: event.target.checked })}
        />
        {text.enable}
      </label>

      <fieldset disabled={!welcome.enabled} className="space-y-4 disabled:opacity-60">
        <div className="space-y-1">
          <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">
            {text.showLabel}
          </span>
          <SegmentedControl<WelcomeShow>
            aria-label={text.showLabel}
            fullWidth
            value={welcome.show}
            onChange={(show) => patchWelcome({ show })}
            options={[
              { value: 'first_visit', label: text.showOptions.first_visit },
              { value: 'always', label: text.showOptions.always },
            ]}
          />
        </div>

        {steps.length === 0 && <p className="text-sm font-semibold text-ink-soft">{text.empty}</p>}

        <ol className="space-y-2" aria-label={text.title}>
          {steps.map((step, index) => (
            <StepCard
              key={step.key}
              step={step}
              index={index}
              steps={steps}
              expanded={open === step.key}
              problems={byStep.get(index) ?? new Set()}
              serverMessages={issues
                .filter((issue) => stepIndexOf(issue.path) === index)
                .map((issue) => issueMessage(issue, es.studio.training.issues))}
              assessment={{
                enabled: assessments.enabled,
                autoEnabled: autoEnabledFor === step.key,
                formId: (flowKey === 'closing' ? assessments.final : assessments.checkIn).formId,
                onEnable: () => {
                  onChange(enableAssessments(settings))
                  setAutoEnabledFor(step.key)
                },
              }}
              activities={activities}
              onToggle={() => setOpen(open === step.key ? null : step.key)}
              onChange={(patch) => setSteps(updateStep(steps, index, patch))}
              onMove={(delta) => setSteps(moveStep(steps, index, delta))}
              onDuplicate={() => {
                const next = duplicateStep(steps, index, text.copySuffix)
                setSteps(next)
                setOpen(next[index + 1]?.key ?? open)
              }}
              onRemove={() => setRemoving(index)}
              onAskAgain={() => setSteps(askAgain(steps, index))}
            />
          ))}
        </ol>

        <div className="space-y-1">
          <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">
            {text.add}
          </span>
          <div className="flex flex-wrap gap-2">
            {types.map((type) => (
              <Button key={type} size="sm" variant="secondary" onClick={() => add(type)}>
                <Plus size={16} strokeWidth={2.5} aria-hidden />
                {text.types[type]}
              </Button>
            ))}
          </div>
          <p className="text-xs font-semibold text-ink-soft">{text.kindsHint}</p>
          {refusal && (
            <p role="alert" className="text-xs font-bold text-danger">
              {refusal}
            </p>
          )}
        </div>
      </fieldset>

      {general.length > 0 && (
        <ul role="alert" className="space-y-1 text-xs font-bold text-danger">
          {general.map((problem) => (
            <li key={`${problem.path}-${problem.code}`}>{text.problems[problem.code]}</li>
          ))}
        </ul>
      )}
      {problems.length > 0 && (
        <p role="status" className="text-xs font-bold text-danger">
          {text.problemSummary(problems.length)}
        </p>
      )}

      {flags.length > 0 && (
        <div className="border-soft space-y-1 rounded-md bg-sun-tint p-3">
          <h4 className="text-sm font-extrabold text-sun-dark">{text.flagsTitle}</h4>
          <ul className="list-disc space-y-1 pl-5 text-xs font-semibold text-sun-dark">
            {flags.map((flag) => (
              <li key={flag}>{text.flags[flag]}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-1">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setPreviewing(true)}
          disabled={!welcome.enabled || steps.length === 0}
        >
          <Eye size={16} strokeWidth={2.5} aria-hidden />
          {text.preview}
        </Button>
        <p className="text-xs font-semibold text-ink-soft">
          {steps.length === 0 ? text.previewEmpty : text.previewHint}
        </p>
      </div>

      <details className="text-xs font-semibold text-ink-soft">
        <summary className="min-h-[44px] cursor-pointer py-2 font-bold text-ink">
          {text.helpTitle}
        </summary>
        <ul className="list-disc space-y-1 pl-5">
          {text.help.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>

      {flowKey === 'welcome' && <ResetProgress mapId={mapId} />}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(value) => !value && setRemoving(null)}
        title={text.removeConfirm.title}
        description={text.removeConfirm.description}
        confirmLabel={text.removeConfirm.confirm}
        cancelLabel={text.removeConfirm.cancel}
        destructive
        onConfirm={() => {
          if (removing !== null) setSteps(deleteStep(steps, removing))
          setRemoving(null)
        }}
      />

      {previewing && (
        <div className="fixed inset-0 z-[60]">
          <LazyWelcomeFlow
            flowKey={flowKey}
            steps={steps}
            mode="preview"
            entries={[]}
            persistence={null}
            documents={previewDocuments}
            courseName={courseName || mapTitle}
            imageUrl={imageUrl}
            hasMusic={hasMusic}
            onFinish={() => setPreviewing(false)}
          />
        </div>
      )}
    </div>
  )
}

// ---- One step ---------------------------------------------------------------------

interface AssessmentState {
  // The map's assessments switch, which the check-in step cannot work without.
  enabled: boolean
  // They were switched on for this step a moment ago.
  autoEnabled: boolean
  formId: string
  onEnable: () => void
}

interface StepCardProps {
  step: WelcomeStep
  index: number
  steps: readonly WelcomeStep[]
  expanded: boolean
  problems: ReadonlySet<string>
  // What the server said about this step, in words.
  serverMessages: readonly string[]
  assessment: AssessmentState
  activities: readonly Activity[]
  onToggle: () => void
  onChange: (patch: Partial<WelcomeStep>) => void
  onMove: (delta: -1 | 1) => void
  onDuplicate: () => void
  onRemove: () => void
  onAskAgain: () => void
}

const StepCard = ({
  step,
  index,
  steps,
  expanded,
  problems,
  serverMessages,
  assessment,
  activities,
  onToggle,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
  onAskAgain,
}: StepCardProps) => {
  const [askedAgain, setAskedAgain] = useState(false)
  const hasProblem = problems.size > 0 || serverMessages.length > 0
  const label = text.stepLabel(index + 1, kindLabel(step), step.title)
  const bodyId = `flow-step-${step.key}`
  const patch = onChange as (value: Partial<typeof step>) => void
  return (
    <li
      className={`border-soft rounded-md bg-surface p-2 ${hasProblem ? 'ring-2 ring-danger' : ''}`}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={bodyId}
          data-field-path={`welcome.steps[${index}]`}
          aria-invalid={serverMessages.length > 0 ? true : undefined}
          aria-label={`${label}. ${expanded ? text.collapse : text.expand}`}
          onClick={onToggle}
          className="flex min-h-[44px] flex-1 items-center gap-2 text-left"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-extrabold text-white">
            {index + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold uppercase tracking-wide text-ink-soft">
              {kindLabel(step)}
              {!step.mandatory && ` · ${es.flow.optionalTag}`}
            </span>
            <span className="block truncate text-sm font-extrabold text-ink">{step.title}</span>
          </span>
          {hasProblem && (
            <span className="text-xs font-bold text-danger">
              {es.studio.flow.problemSummary(problems.size)}
            </span>
          )}
        </button>
        <IconButton
          aria-label={`${text.moveUp}: ${step.title}`}
          title={text.moveUp}
          disabled={!canMove(steps, index, -1)}
          onClick={() => onMove(-1)}
        >
          <ChevronUp size={16} strokeWidth={3} aria-hidden />
        </IconButton>
        <IconButton
          aria-label={`${text.moveDown}: ${step.title}`}
          title={text.moveDown}
          disabled={!canMove(steps, index, 1)}
          onClick={() => onMove(1)}
        >
          <ChevronDown size={16} strokeWidth={3} aria-hidden />
        </IconButton>
        {step.type !== 'welcome' && (
          <IconButton
            aria-label={`${text.duplicate}: ${step.title}`}
            title={text.duplicate}
            onClick={onDuplicate}
          >
            <Copy size={16} strokeWidth={2.5} aria-hidden />
          </IconButton>
        )}
        <IconButton
          aria-label={`${text.remove}: ${step.title}`}
          title={text.remove}
          onClick={onRemove}
        >
          <Trash2 size={16} strokeWidth={2.5} aria-hidden />
        </IconButton>
      </div>

      {serverMessages.length > 0 && (
        <ul className="mt-1 space-y-1 text-xs font-bold text-danger">
          {serverMessages.map((message) => (
            <li key={message} className="flex items-start gap-1.5">
              <AlertCircle size={14} strokeWidth={2.5} aria-hidden className="mt-0.5 shrink-0" />
              <span>
                <span className="sr-only">{es.studio.training.fieldError}: </span>
                {message}
              </span>
            </li>
          ))}
        </ul>
      )}

      {expanded && (
        <div id={bodyId} className="mt-2 space-y-3 border-t border-line pt-3">
          <div className="space-y-1">
            <label
              htmlFor={`${bodyId}-title`}
              className="text-xs font-bold uppercase tracking-wide text-ink-soft"
            >
              {text.stepTitle}
            </label>
            <Input
              id={`${bodyId}-title`}
              density="compact"
              value={step.title}
              maxLength={120}
              aria-invalid={problems.has('title')}
              onChange={(event) => onChange({ title: event.target.value })}
            />
            {problems.has('title') && (
              <p role="alert" className="text-xs font-bold text-danger">
                {text.problems.step_title_invalid}
              </p>
            )}
          </div>

          {step.type === 'welcome' && (
            <WelcomeEditor step={step} onChange={patch} problems={problems} />
          )}
          {step.type === 'video' && (
            <VideoEditor step={step} onChange={patch} problems={problems} />
          )}
          {step.type === 'html' && <HtmlEditor step={step} onChange={patch} problems={problems} />}
          {step.type === 'pdf' && <PdfEditor step={step} onChange={patch} problems={problems} />}
          {step.type === 'assessment' && <AssessmentEditor {...assessment} />}
          {step.type === 'quiz' && (
            <QuizEditor step={step} onChange={patch} problems={problems} activities={activities} />
          )}

          {step.type !== 'welcome' && (
            <div className="space-y-1">
              <label className="flex min-h-[44px] items-start gap-2 text-sm font-bold text-ink">
                <input
                  className={`${checkboxClass} mt-0.5`}
                  type="checkbox"
                  checked={step.mandatory}
                  onChange={(event) => onChange({ mandatory: event.target.checked })}
                />
                <span>
                  {text.mandatory}
                  <span className="block text-xs font-semibold text-ink-soft">
                    {text.mandatoryHint}
                  </span>
                </span>
              </label>
            </div>
          )}

          <div className="space-y-1">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                onAskAgain()
                setAskedAgain(true)
              }}
            >
              {text.askAgain}
            </Button>
            <p className="text-xs font-semibold text-ink-soft">
              {text.revision(step.revision)}.{' '}
              {askedAgain ? text.askAgainDone(step.revision) : text.askAgainHint}
            </p>
          </div>
        </div>
      )}
    </li>
  )
}

// ---- Reset the own progress ---------------------------------------------------------

// Inside Moodle only: the progress lives there. Moodle allows it with editing mode
// on, and answers readonly otherwise; the hint says so before the click.
const ResetProgress = ({ mapId }: { mapId: string }) => {
  const embed = useEmbed()
  const [asked, setAsked] = useState(false)
  const progress = useSyncExternalStore(subscribeHostFlow, () => getHostFlowProgress(mapId))
  if (!embed) return null
  const refused = asked && progress?.status === 'error' && progress.error === 'readonly'
  return (
    <div className="border-soft space-y-1 rounded-md p-3">
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          setAsked(true)
          embed.resetFlowProgress(mapId)
        }}
      >
        <RotateCcw size={16} strokeWidth={2.5} aria-hidden />
        {text.reset}
      </Button>
      <p className="text-xs font-semibold text-ink-soft">{text.resetHint}</p>
      {asked && !refused && (
        <p role="status" className="text-xs font-bold text-ink">
          {text.resetSent}
        </p>
      )}
      {refused && (
        <p role="alert" className="text-xs font-bold text-danger">
          {text.resetReadonly}
        </p>
      )}
    </div>
  )
}
