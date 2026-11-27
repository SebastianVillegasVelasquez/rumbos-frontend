import { useEffect, useState, type Dispatch } from 'react'
import { CheckCircle2, ExternalLink, Info, Loader2 } from 'lucide-react'
import { Button } from '../../../components/ui/Button.tsx'
import { es } from '../../../i18n/es.ts'
import type { WelcomeMoodleActivityStep } from '../../course-map/data/types.ts'
import { useEmbed } from '../../embed/EmbedContext.ts'
import { useActivityList, useActivityView } from '../../embed/hostActivities.ts'
import {
  useHostActivitiesListable,
  useHostActivityAvailable,
} from '../../embed/hostCapabilities.ts'
import { ACTIVITY_OPEN_WAIT_MS, activityStepModel } from './activityStepView.ts'
import type { FlowEvent, FlowState } from './flowReducer.ts'
import { FlowStatus } from './FlowStatus.tsx'
import { PreviewActivity } from './PreviewActivity.tsx'

const text = es.flow.activity

// A step that opens an activity of the Moodle course in the host's overlay (contract v5.11).
// The app sends the cmid and nothing else; the host checks it, builds the address and tells
// what happened. The step is done when the activity was shown and then closed, and that is
// kept through the flow's own record (flow-step-done), like a video. Nothing here writes the
// student's Moodle completion: only the host's own view of the activity does.
interface StepActivityProps {
  step: WelcomeMoodleActivityStep
  state: FlowState
  dispatch: Dispatch<FlowEvent>
}

export const StepActivity = (props: StepActivityProps) =>
  props.state.mode === 'preview' ? (
    <PreviewStepActivity step={props.step} />
  ) : (
    <LiveStepActivity {...props} />
  )

// The editor's preview shows which activity the step points at, from the course's activity
// list (a read); the activity itself opens only on the button that says so.
const useActivityName = (cmid: number): string | null => {
  const embed = useEmbed()
  const list = useActivityList()
  const listable = useHostActivitiesListable()
  const requestActivities = embed?.requestActivities
  useEffect(() => {
    if (embed?.mode === 'editor' && listable && list.status === 'idle') requestActivities?.()
  }, [embed?.mode, listable, list.status, requestActivities])
  return embed?.mode === 'editor' && list.status === 'ready'
    ? (list.items.find((item) => item.cmid === cmid)?.name ?? null)
    : null
}

const PreviewStepActivity = ({ step }: { step: WelcomeMoodleActivityStep }) => {
  const embed = useEmbed()
  const hostCanOpen = useHostActivityAvailable()
  const activityName = useActivityName(step.cmid)
  return (
    <div className="flow-pad">
      <PreviewActivity
        title={step.title}
        detail={activityName === null ? null : text.activityName(activityName)}
        onOpenForReal={
          embed
            ? () =>
                hostCanOpen ? embed.openFlowActivity(step.cmid) : embed.openActivity(step.cmid)
            : undefined
        }
      />
    </div>
  )
}

const LiveStepActivity = ({ step, dispatch }: StepActivityProps) => {
  const embed = useEmbed()
  const hostCanOpen = useHostActivityAvailable()
  const view = useActivityView(step.cmid)
  const activityName = useActivityName(step.cmid)
  const [silentFor, setSilentFor] = useState<number | null>(null)

  // The host got the request and never answered: say so and give the button back.
  const opening = view.status === 'opening'
  useEffect(() => {
    if (!opening) return
    const id = window.setTimeout(() => setSilentFor(step.cmid), ACTIVITY_OPEN_WAIT_MS)
    return () => {
      window.clearTimeout(id)
      setSilentFor(null)
    }
  }, [opening, step.cmid])

  const model = activityStepModel({
    capability: embed !== null && hostCanOpen,
    view,
    silent: silentFor === step.cmid,
  })

  // The activity cannot be shown at all: the step does not block and records `unavailable`.
  useEffect(() => {
    if (model.unavailable) dispatch({ type: 'unavailable' })
  }, [model.unavailable, dispatch])

  // Seen: opened, shown, then closed (the store only says so in that order).
  useEffect(() => {
    if (model.seen) dispatch({ type: 'activity-seen' })
  }, [model.seen, dispatch])

  const label = model.openLabel === null ? null : text[model.openLabel]

  return (
    <div className="flow-pad space-y-4">
      <section
        aria-label={text.cardLabel(step.title)}
        aria-busy={model.busy}
        className="border-soft flex flex-col items-start gap-3 rounded-lg bg-surface p-4 text-ink"
      >
        <p className="text-lg font-bold">{step.title}</p>
        {activityName !== null && (
          <p className="text-sm font-semibold text-ink-soft">{text.activityName(activityName)}</p>
        )}
        {label !== null && (
          <Button
            variant={model.seen ? 'surface' : 'secondary'}
            disabled={model.openDisabled}
            aria-label={`${label}: ${step.title}`}
            onClick={() => embed?.openFlowActivity(step.cmid)}
          >
            {model.busy ? (
              <Loader2
                size={16}
                strokeWidth={2.5}
                className="motion-safe:animate-spin"
                aria-hidden
              />
            ) : (
              <ExternalLink size={16} strokeWidth={2.5} aria-hidden />
            )}
            {label}
          </Button>
        )}
      </section>
      {/* The region is always there, so each change of what it says is read out. */}
      <div aria-live="polite" role="status">
        <FlowStatus
          icon={
            model.seen ? (
              <CheckCircle2 size={20} strokeWidth={2.5} className="text-leaf-dark" />
            ) : (
              <Info size={18} strokeWidth={2.5} />
            )
          }
          className="text-base text-ink"
        >
          {text.messages[model.message]}
        </FlowStatus>
      </div>
      {model.escape && (
        <div className="border-soft flex flex-col items-start gap-2 rounded-md bg-surface-muted p-3">
          <p className="text-sm text-ink-soft">{text.escapeHint}</p>
          <Button variant="surface" size="sm" onClick={() => dispatch({ type: 'activity-escape' })}>
            {text.escape}
          </Button>
        </div>
      )}
    </div>
  )
}
