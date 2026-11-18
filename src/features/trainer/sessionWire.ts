import { ContractError, Issues, isRecord, kindOf } from '../course-map/data/contract.ts'
import type {
  AnswerResult,
  Option,
  Progress,
  SessionStart,
  SessionSummary,
  Step,
  StepAudio,
} from './types.ts'

// The practice sessions as the backend sends them (openapi.json: SessionView, AnswerOut,
// FinishOut) and as the screens read them. The two differ in shape, so this is the one
// place where they meet, checked at the edge: a body the screens cannot read is a
// ContractError naming the endpoint and the fields.
//
// The wire gives an exercise's steps all at once and answers `next: null`; a dialogue
// gives one turn at a time and `next` is the following turn. The screens are written for
// "a step, then the next one", so a SessionCursor walks an exercise's steps.

const STEP_TYPES = [
  'mcq',
  'listen_choose',
  'gap_fill',
  'reorder',
  'match',
  'short_answer',
  'dialogue_turn',
] as const

const asOptions = (path: string, value: unknown, issues: Issues): Option[] => {
  if (!Array.isArray(value)) {
    issues.add(path, 'an array', value)
    return []
  }
  return value.flatMap((entry, index): Option[] => {
    if (!isRecord(entry) || typeof entry.id !== 'string' || typeof entry.text !== 'string') {
      issues.add(`${path}[${index}]`, '{ id, text }', entry)
      return []
    }
    return [{ option_id: entry.id, text: entry.text }]
  })
}

// The wire's audio is `{ url, duration_s }`: no transcript.
const asAudio = (path: string, value: unknown, issues: Issues): StepAudio | null => {
  if (value === null || value === undefined) return null
  if (!isRecord(value)) {
    issues.add(path, 'an object or null', value)
    return null
  }
  issues.string(`${path}.url`, value.url)
  issues.number(`${path}.duration_s`, value.duration_s)
  return { url: String(value.url), duration_s: Number(value.duration_s), transcript: null }
}

const asStrings = (path: string, value: unknown, issues: Issues): string[] => {
  const out: string[] = []
  issues.array(path, value, (p, v) => {
    if (typeof v === 'string') out.push(v)
    else issues.add(p, 'a string', v)
  })
  return out
}

// A step of an exercise or a turn of a dialogue, in the screens' shape.
export const toStep = (path: string, value: unknown, issues: Issues): Step | null => {
  if (!isRecord(value)) {
    issues.add(path, 'an object', value)
    return null
  }
  issues.string(`${path}.step_id`, value.step_id)
  issues.oneOf(`${path}.type`, value.type, STEP_TYPES)
  const type = value.type as (typeof STEP_TYPES)[number]
  const base = {
    step_id: String(value.step_id),
    prompt: typeof value.prompt === 'string' ? value.prompt : '',
    hint: typeof value.hint === 'string' ? value.hint : null,
    audio: asAudio(`${path}.audio`, value.audio, issues),
  }
  switch (type) {
    case 'mcq':
    case 'listen_choose':
      return { ...base, type, options: asOptions(`${path}.options`, value.options, issues) }
    case 'gap_fill': {
      issues.string(`${path}.template`, value.template)
      const gaps: { gap_id: string; options: Option[] | null }[] = []
      issues.array(`${path}.gaps`, value.gaps, (p, gap) => {
        if (!issues.record(p, gap)) return
        issues.string(`${p}.gap_id`, gap.gap_id)
        gaps.push({
          gap_id: String(gap.gap_id),
          options: gap.options == null ? null : asOptions(`${p}.options`, gap.options, issues),
        })
      })
      return { ...base, type, template: String(value.template), gaps }
    }
    case 'reorder':
      return {
        ...base,
        type,
        tokens: asOptions(`${path}.tokens`, value.tokens, issues).map((o) => ({
          token_id: o.option_id,
          text: o.text,
        })),
      }
    case 'match': {
      const side = (key: string) =>
        asOptions(`${path}.${key}`, value[key], issues).map((o) => ({
          id: o.option_id,
          text: o.text,
        }))
      return { ...base, type, left: side('left'), right: side('right') }
    }
    case 'short_answer':
      issues.number(`${path}.max_length`, value.max_length)
      return { ...base, type, max_length: Number(value.max_length) }
    case 'dialogue_turn': {
      issues.string(`${path}.partner_line`, value.partner_line)
      issues.oneOf(`${path}.mode`, value.mode, ['choose', 'type'])
      const options = asOptions(`${path}.options`, value.options, issues)
      return {
        ...base,
        type,
        partner_line: {
          text: String(value.partner_line),
          translation: typeof value.translation === 'string' ? value.translation : null,
          audio: base.audio,
        },
        mode: value.mode === 'type' ? 'type' : 'choose',
        options: options.length > 0 ? options : null,
        starters: asStrings(`${path}.starters`, value.starters, issues),
        word_bank: asStrings(`${path}.word_bank`, value.word_bank, issues),
      }
    }
  }
  return null
}

// Where a session stands: the steps of an exercise (the screens walk them), or the one
// turn of a dialogue.
export interface SessionCursor {
  kind: 'exercise' | 'dialogue'
  steps: Step[]
}

export interface StartedSession {
  start: Omit<SessionStart, 'preview'>
  cursor: SessionCursor
}

const objectOrFail = (value: unknown, endpoint: string): Record<string, unknown> => {
  if (!isRecord(value))
    throw new ContractError(endpoint, [`body: expected an object, got ${kindOf(value)}`])
  return value
}

// SessionView -> the first step to answer and where it sits. An exercise that was started
// before resumes at its first step without an answer.
export const readSession = (raw: unknown, endpoint: string): StartedSession => {
  const value = objectOrFail(raw, endpoint)
  const issues = new Issues()
  issues.string('session_id', value.session_id)
  issues.string('activity_id', value.activity_id)
  issues.string('title', value.title)
  issues.oneOf('status', value.status, ['in_progress', 'finished'])
  issues.oneOf('kind', value.kind, ['exercise', 'dialogue'])
  const steps: Step[] = []
  const answered: boolean[] = []
  issues.array('steps', value.steps, (path, step) => {
    const read = toStep(path, step, issues)
    if (!read) return
    steps.push(read)
    answered.push(isRecord(step) && step.answered === true)
  })
  if (Array.isArray(value.steps) && value.steps.length === 0 && value.status === 'in_progress')
    issues.list.push('steps: expected at least one step in a session in progress')
  issues.settle(endpoint)
  const kind = value.kind === 'dialogue' ? 'dialogue' : 'exercise'
  const index = Math.max(0, answered.indexOf(false))
  const current = steps[kind === 'dialogue' ? 0 : index] as Step
  const total = kind === 'dialogue' ? Number(value.turns_total) || 1 : steps.length
  const position = kind === 'dialogue' ? Number(value.turn) || 1 : index + 1
  return {
    start: {
      session_id: String(value.session_id),
      step: current,
      progress: { index: position, total },
    },
    cursor: { kind, steps },
  }
}

// AnswerOut -> what the screens show after an answer. In an exercise the next step is the
// following one of the cursor; in a dialogue it is the turn the server sends (null when
// the conversation is over).
export const readAnswer = (
  raw: unknown,
  cursor: SessionCursor,
  stepId: string,
  endpoint: string
): AnswerResult => {
  const value = objectOrFail(raw, endpoint)
  const issues = new Issues()
  issues.oneOf('outcome', value.outcome, ['correct', 'partial', 'incorrect', 'accepted'])
  issues.boolean('finished', value.finished)
  const feedback = isRecord(value.feedback) ? value.feedback : null
  if (!feedback) issues.add('feedback', 'an object', value.feedback)
  const tags = feedback ? asStrings('feedback.error_tags', feedback.error_tags, issues) : []
  let next: Step | null = null
  if (cursor.kind === 'dialogue') {
    if (value.next != null) next = toStep('next', value.next, issues)
  } else if (value.next != null) issues.add('next', 'null (an exercise answers none)', value.next)
  issues.settle(endpoint)
  let progress: Progress
  if (cursor.kind === 'dialogue') {
    const total = cursor.steps.length
    progress = { index: total, total }
    if (next) cursor.steps = [next]
  } else {
    const at = cursor.steps.findIndex((step) => step.step_id === stepId)
    next = cursor.steps[at + 1] ?? null
    progress = { index: at + 1, total: cursor.steps.length }
  }
  const text = (key: string) =>
    feedback && typeof feedback[key] === 'string' ? (feedback[key] as string) : null
  return {
    outcome: value.outcome as AnswerResult['outcome'],
    feedback: {
      explanation: text('explanation'),
      closest_answer: text('closest_answer'),
      error_tags: tags.map((tag) => ({ tag, text: tag })),
    },
    next_step: next,
    progress,
  }
}

// FinishOut -> the summary the screen shows. The wire's summary counts first-try answers
// and names what to revise; the rest of what the screen can show (what went well, new
// words, what the student can now do, the next activity) the wire does not carry: the
// intro and "next activity" come from the catalog (see activityInfo.ts).
export const readSummary = (raw: unknown, endpoint: string): SessionSummary => {
  const value = objectOrFail(raw, endpoint)
  const issues = new Issues()
  issues.string('session_id', value.session_id)
  const summary = isRecord(value.summary) ? value.summary : null
  if (!summary) issues.add('summary', 'an object', value.summary)
  else {
    issues.number('summary.first_try_correct', summary.first_try_correct)
    issues.number('summary.steps_total', summary.steps_total)
  }
  const revise = summary ? asStrings('summary.to_revise', summary.to_revise, issues) : []
  issues.settle(endpoint)
  return {
    score: { correct: Number(summary?.first_try_correct), total: Number(summary?.steps_total) },
    went_well: [],
    to_improve: revise.map((tag) => ({ tag, text: tag, example: null })),
    new_vocabulary: [],
    can_do: [],
    next_activity_id: null,
  }
}
