import { CheckCircle2, Clock, Flag, Info } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button.tsx'
import { esAssessment } from '../../i18n/assessment.es.ts'
import { ReportForm } from './ReportForm.tsx'
import type { SimulatedOutcome } from './simulation.ts'
import type { AssessmentPolicy, AssessmentPurpose, AssessmentResult } from './types.ts'

const text = esAssessment.result

// Ten cells, filled in proportion to the percent. The number always sits beside it,
// so the meter is a shape and a word, never a color.
const filledCells = (percent: string): number =>
  Math.max(0, Math.min(10, Math.floor(Number(percent) / 10)))

const Meter = ({ percent }: { percent: string }) => (
  <span className="exam-meter" aria-hidden>
    {Array.from({ length: 10 }, (_, i) => (
      <span key={i} data-on={i < filledCells(percent)} />
    ))}
  </span>
)

// What the passback is doing, as true as the backend says it: "completado" appears
// only when the sync is done, never on a guess.
const SyncNote = ({ result }: { result: AssessmentResult }) => {
  const state = result.sync.state
  if (!result.passed || state === 'not_required') return null
  const icon =
    state === 'synced' ? (
      <CheckCircle2 size={18} strokeWidth={2.5} aria-hidden />
    ) : state === 'pending' ? (
      <Clock size={18} strokeWidth={2.5} aria-hidden />
    ) : (
      <Info size={18} strokeWidth={2.5} aria-hidden />
    )
  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-md bg-primary-tint p-3 font-semibold"
    >
      <span className="mt-0.5 flex-none">{icon}</span>
      <span>{text.sync[state]}</span>
    </p>
  )
}

// The result screen. It shows the percent, the pass statement, the band, the profile
// by section and the module map; never which answers were right (the server does not
// send them, and three attempts on one form would leak the key).
export const ExamResult = ({
  purpose,
  result,
  preview,
  onAgain,
  policy,
  simulated,
}: {
  purpose: AssessmentPurpose
  result: AssessmentResult
  preview: boolean
  // Offered on the final exam only, while attempts remain.
  onAgain?: () => void
  // The pass rule, to say what the congratulations rest on; without it the plain sentence.
  policy?: AssessmentPolicy
  // An editor's simulation: the result is synthetic, so nothing here may start an attempt,
  // send a report or look like a student's result. `closing` is the "Ver cierre" action.
  simulated?: { outcome: SimulatedOutcome; closing?: 'none' | (() => void) } | null
}) => {
  const [reporting, setReporting] = useState(false)
  const left = Math.max(0, result.attempts.max - result.attempts.used)
  const strict = policy?.pass_operator !== 'gte'
  const statement = result.passed
    ? policy
      ? text.congrats[purpose](result.percent, policy.pass_percent, strict)
      : text.passed
    : purpose === 'check_in'
      ? text.notPassedCheckIn
      : text.notPassedFinal(left)
  const title = purpose === 'check_in' ? text.checkInTitle : text.title
  // The result is the screen's news: focus its heading when a (new) result is drawn.
  const shown = `${result.percent}|${result.passed}|${simulated?.outcome ?? ''}`
  useEffect(() => {
    if (simulated) document.getElementById('exam-result-title')?.focus()
  }, [shown, simulated])
  return (
    <div className="flex flex-col gap-5" data-simulated={simulated ? 'true' : undefined}>
      {simulated && (
        <p
          role="note"
          data-testid="simulation-banner"
          className="rounded-md border-2 border-dashed border-sun-dark bg-sun-tint p-3 font-extrabold text-sun-dark"
        >
          {esAssessment.simulation.banner}
        </p>
      )}
      <div className="flex flex-col gap-1">
        <h2 tabIndex={-1} id="exam-result-title" className="flow-title font-heading font-extrabold">
          {title}
        </h2>
        {purpose === 'check_in' && <p className="flow-prose">{text.checkInBody}</p>}
      </div>

      {preview && (
        <p role="note" className="rounded-md bg-sun-tint p-3 font-semibold text-sun-dark">
          {esAssessment.previewResult}
        </p>
      )}

      {result.status === 'expired' && (
        <p role="status" className="rounded-md bg-sun-tint p-3 font-semibold text-sun-dark">
          {esAssessment.result.expired}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <p className="font-heading text-5xl font-extrabold">{text.percent(result.percent)}</p>
        <p className="font-bold">{text.band(text.bands[result.band])}</p>
      </div>
      <p role="status" aria-live="polite" className="flow-prose font-semibold">
        {statement}
      </p>
      {simulated?.outcome === 'boundary' && policy && (
        <p className="flow-prose font-semibold">
          {esAssessment.simulation.boundaryNote(policy.pass_percent, strict)}
        </p>
      )}
      {simulated && !result.passed && (
        <p className="flow-prose">{esAssessment.simulation.failNote}</p>
      )}
      {!preview && <SyncNote result={result} />}

      <section aria-labelledby="exam-profile" className="flex flex-col gap-2">
        <h3 id="exam-profile" className="text-lg font-extrabold">
          {text.profile}
        </h3>
        <ul className="flex flex-col gap-2">
          {result.by_section.map((section) => (
            <li key={section.key} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="min-w-[10ch] flex-1 font-semibold">
                {esAssessment.sections[section.key as keyof typeof esAssessment.sections] ??
                  section.key}
                <span className="ml-2 text-xs font-medium text-ink-soft">
                  {text.weight(section.weight)}
                </span>
              </span>
              <Meter percent={section.percent} />
              <span className="w-14 text-right font-bold">{section.percent} %</span>
            </li>
          ))}
        </ul>
      </section>

      {result.by_module.length > 0 && (
        <section aria-labelledby="exam-modules" className="flex flex-col gap-2">
          <h3 id="exam-modules" className="text-lg font-extrabold">
            {text.modules}
          </h3>
          <ul className="flex flex-col gap-2">
            {result.by_module.map((module) => (
              <li key={module.module} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="min-w-[10ch] flex-1 font-semibold">{module.module}</span>
                <Meter percent={module.percent} />
                <span className="w-14 text-right font-bold">{module.percent} %</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-sm text-ink-soft">
        {text.attempts(result.attempts.used, result.attempts.max)}
        {result.gain !== null && ` · ${text.gain(result.gain)}`}
      </p>
      <p className="text-sm text-ink-soft">{text.noAnswers}</p>

      {simulated ? (
        // No report and no new attempt: both would be real calls.
        result.passed &&
        simulated.closing && (
          <div className="flex flex-col items-start gap-2">
            {simulated.closing === 'none' ? (
              <p className="text-sm font-semibold text-ink-soft">
                {esAssessment.simulation.noClosing}
              </p>
            ) : (
              <Button variant="secondary" onClick={simulated.closing}>
                {esAssessment.simulation.openClosing}
              </Button>
            )}
          </div>
        )
      ) : reporting ? (
        <div className="rounded-md border-soft p-4">
          <ReportForm onClose={() => setReporting(false)} />
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {onAgain && left > 0 && !result.passed && (
            <Button variant="secondary" onClick={onAgain}>
              {text.again}
            </Button>
          )}
          <Button variant="surface" dense onClick={() => setReporting(true)}>
            <Flag size={16} strokeWidth={2.5} aria-hidden />
            {text.report}
          </Button>
        </div>
      )}
    </div>
  )
}
