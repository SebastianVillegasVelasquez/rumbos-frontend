import { useId, useState } from 'react'
import { Button } from '../../components/ui/Button.tsx'
import { esAssessment } from '../../i18n/assessment.es.ts'
import { REPORT_NOTE_MAX, sendReport, type ReportReason } from './api.ts'

const text = esAssessment.report
const REASONS = Object.keys(text.reasons) as ReportReason[]

// "Reportar un error": a reason and an optional note, posted to /reports. Used on a
// practice step and on the exam's result screen (for the whole exam). Failure keeps
// what was typed and offers the retry; nothing here is a trap.
export const ReportForm = ({
  activityId = null,
  stepId = null,
  onClose,
}: {
  activityId?: string | null
  stepId?: string | null
  onClose: () => void
}) => {
  const [reason, setReason] = useState<ReportReason>('wrong_answer')
  const [note, setNote] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  const noteId = useId()

  const send = async () => {
    setStatus('sending')
    try {
      await sendReport({
        activity_id: activityId,
        step_id: stepId,
        item_id: null,
        reason,
        note: note.trim() === '' ? null : note.trim(),
      })
      setStatus('sent')
    } catch {
      setStatus('failed')
    }
  }

  if (status === 'sent')
    return (
      <div className="flex flex-col items-start gap-3">
        <p role="status" className="font-semibold">
          {text.sent}
        </p>
        <Button variant="surface" dense onClick={onClose}>
          {text.close}
        </Button>
      </div>
    )

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        void send()
      }}
    >
      <h3 className="text-lg font-extrabold">{text.title}</h3>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-bold">{text.reason}</legend>
        {REASONS.map((value) => (
          <label key={value} className="exam-choice">
            <input
              type="radio"
              name="report-reason"
              value={value}
              checked={reason === value}
              onChange={() => setReason(value)}
            />
            <span className="exam-choice-mark" aria-hidden />
            <span>{text.reasons[value]}</span>
          </label>
        ))}
      </fieldset>
      <label htmlFor={noteId} className="text-sm font-bold">
        {text.note}
      </label>
      <textarea
        id={noteId}
        className="exam-field min-h-[88px]"
        maxLength={REPORT_NOTE_MAX}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        aria-describedby={`${noteId}-max`}
      />
      <p id={`${noteId}-max`} className="text-xs text-ink-soft">
        {text.noteMax(REPORT_NOTE_MAX)}
      </p>
      {status === 'failed' && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {text.failed}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="secondary" disabled={status === 'sending'}>
          {status === 'sending' ? text.sending : text.send}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          {text.cancel}
        </Button>
      </div>
    </form>
  )
}
