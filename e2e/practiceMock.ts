// The practice half of contract v2 for the mock server: a catalog, four activities
// (grammar with every step type, listening, writing, a guided dialogue), sessions that
// grade on the "server" side, idempotent answers by attempt_id, a vocabulary box and
// progress. Practice answers DO carry feedback by contract; none of this is the
// assessment (which never does).
//
// Sessions, answers, finish and the catalog are answered from openapi.json: the body is
// built from the spec's response schema (or checked against it) before it leaves, so a
// mock that drifts from the contract throws here. The vocabulary, progress and review
// answers are still the front's old shapes (the spec differs: see the report).

import { specReply, validated } from '../src/contracts/openapiExample.ts'

export interface PracticeOptions {
  // catalog.enabled (false: the stage says it is not available).
  enabled?: boolean
  preview?: boolean
  // The first N answers fail with this status (0 = the connection drops).
  failAnswers?: number
  failAnswerStatus?: number
  // catalog.reason when enabled is false (contract: additive field).
  reason?: 'disabled_for_map' | 'no_published_content'
  // The catalog answers this status (0: the connection drops).
  catalogStatus?: number
  // Only the first N catalog calls fail (with catalogStatus, 503 by default); the next
  // ones succeed, which is what the retry button is for.
  catalogFailures?: number
  // The catalog answers only once this settles: the test holds the loading state for as
  // long as it needs, on a machine of any speed.
  catalogHeld?: Promise<void>
  // The catalog answers exactly this body with a 200, whatever else is set: for the
  // shapes the production backend sends that the fixture below does not model.
  catalogBody?: unknown
  // Mark the second lesson and the listening activity as not yet published.
  unpublished?: boolean
  // Words due for review.
  dueWords?: number
  // The course's level (the catalog says it; A1 and A2 have content).
  level?: 'A1' | 'A2' | 'B1' | 'B2'
}

export interface PracticeReply {
  status: number
  body: unknown
  abort?: boolean
  // Answer once this settles, with what `then` returns.
  waitFor?: Promise<void>
  then?: () => PracticeReply
}

// Steps are written in the wire's shape (rumbos-backend: views.py, and its documented
// examples): options, tokens and match items are `{ id, text }`, an audio has no
// transcript, a dialogue turn has its partner line as a string. `grade` plays the server.
type StepDef = {
  step: Record<string, unknown>
  grade: (response: Record<string, unknown>) => Grade
}
interface Grade {
  outcome: 'correct' | 'partial' | 'incorrect' | 'accepted'
  explanation?: string
  closest?: string
  tags?: string[]
}

const base = (id: string, type: string, prompt: string, extra: Record<string, unknown>) => ({
  step_id: id,
  type,
  prompt,
  hint: null,
  audio: null,
  ...extra,
})

const turn = (id: string, extra: Record<string, unknown>) => ({
  step_id: id,
  type: 'dialogue_turn',
  translation: null,
  audio: null,
  options: [],
  starters: [],
  word_bank: [],
  ...extra,
})

const ACTIVITIES: Record<
  string,
  { title: string; skill: string; kind: 'exercise' | 'dialogue'; steps: StepDef[] }
> = {
  'act-gram': {
    title: 'Verb to be',
    skill: 'grammar',
    kind: 'exercise',
    steps: [
      {
        step: base('g1', 'mcq', 'She ___ a teacher.', {
          options: [
            { id: 'a', text: 'am' },
            { id: 'b', text: 'is' },
          ],
        }),
        grade: (r) =>
          r.option_id === 'b'
            ? { outcome: 'correct', explanation: 'Con she usamos is.' }
            : { outcome: 'incorrect', explanation: 'Con she usamos is.', closest: 'is' },
      },
      {
        step: base('g2', 'gap_fill', 'Completa.', {
          template: 'I {1} from {2}.',
          gaps: [
            {
              gap_id: '1',
              options: [
                { id: 'am', text: 'am' },
                { id: 'are', text: 'are' },
              ],
            },
            { gap_id: '2', options: null },
          ],
        }),
        grade: (r) => {
          const v = (r.values ?? {}) as Record<string, string>
          return v['1'] === 'am' && v['2']?.trim().toLowerCase() === 'colombia'
            ? { outcome: 'correct' }
            : { outcome: 'partial', closest: 'I am from Colombia.' }
        },
      },
      {
        step: base('g3', 'reorder', 'Ordena la frase.', {
          tokens: [
            { id: 't3', text: 'a' },
            { id: 't1', text: 'I' },
            { id: 't4', text: 'student' },
            { id: 't2', text: 'am' },
          ],
        }),
        grade: (r) =>
          JSON.stringify(r.token_ids) === JSON.stringify(['t1', 't2', 't3', 't4'])
            ? { outcome: 'correct' }
            : { outcome: 'incorrect', closest: 'I am a student' },
      },
      {
        step: base('g4', 'match', 'Une cada palabra.', {
          left: [
            { id: 'l1', text: 'cat' },
            { id: 'l2', text: 'dog' },
          ],
          right: [
            { id: 'r2', text: 'perro' },
            { id: 'r1', text: 'gato' },
          ],
        }),
        grade: (r) => {
          const pairs = (r.pairs ?? []) as string[][]
          const ok = pairs.every(([l, rr]) => l.slice(1) === rr.slice(1))
          return ok ? { outcome: 'correct' } : { outcome: 'incorrect' }
        },
      },
    ],
  },
  'act-listen': {
    title: 'Escucha: saludos',
    skill: 'listening',
    kind: 'exercise',
    steps: [
      {
        step: base('s1', 'listen_choose', 'What does she say?', {
          audio: { url: '/__tone.wav', duration_s: 2 },
          options: [
            { id: 'a', text: 'Good morning' },
            { id: 'b', text: 'Good night' },
          ],
        }),
        grade: (r) => (r.option_id === 'a' ? { outcome: 'correct' } : { outcome: 'incorrect' }),
      },
    ],
  },
  'act-write': {
    title: 'Escribe sobre ti',
    skill: 'writing',
    kind: 'exercise',
    steps: [
      {
        step: base('w1', 'short_answer', 'Who are you?', { max_length: 80 }),
        grade: (r) =>
          String(r.text ?? '')
            .trim()
            .toLowerCase() === 'i am a student'
            ? { outcome: 'correct' }
            : {
                outcome: 'partial',
                closest: 'I am a student',
                explanation: 'Falta el artículo a.',
                tags: ['Usa a antes de una profesión.'],
              },
      },
    ],
  },
  'act-dial': {
    title: 'En el hotel',
    skill: 'dialogue',
    kind: 'dialogue',
    steps: [
      {
        step: turn('d1', {
          partner_line: 'Good evening. Do you have a reservation?',
          translation: 'Buenas noches. ¿Tiene una reserva?',
          mode: 'choose',
          options: [
            { id: 'o1', text: 'Yes, I do.' },
            { id: 'o2', text: 'Banana.' },
          ],
        }),
        grade: (r) =>
          r.option_id === 'o1'
            ? { outcome: 'accepted', explanation: 'Buena respuesta.' }
            : { outcome: 'incorrect', closest: 'Yes, I do.' },
      },
      {
        step: turn('d2', {
          partner_line: 'What is your name?',
          mode: 'type',
          starters: ['My name is'],
          word_bank: ['Sebastian', 'Ana'],
        }),
        grade: (r) =>
          String(r.text ?? '').trim() !== '' ? { outcome: 'accepted' } : { outcome: 'incorrect' },
      },
    ],
  },
}

interface SessionRecord {
  id: string
  activity: string
  finished: boolean
  // Every try, in order: what the server keeps and the summary counts.
  tries: { step: string; attempt: string; outcome: Grade['outcome'] }[]
  // A dialogue's current turn.
  turn: number
}

export class PracticeMock {
  readonly sessions = new Map<string, SessionRecord>()
  readonly answered = new Map<string, unknown>()
  readonly saved = new Set<string>(['w-hello'])
  readonly reviews: { word: string; knew: boolean; attempt: string }[] = []
  private failures = 0
  private seq = 0
  private catalogCalls = 0
  // How many times the server actually graded (idempotent repeats are not counted).
  gradedCount = 0

  private readonly options: PracticeOptions

  constructor(options: PracticeOptions = {}) {
    this.options = options
  }

  get preview() {
    return this.options.preview ?? false
  }

  private catalog() {
    return {
      enabled: this.options.enabled ?? true,
      language: 'en',
      level: this.options.level ?? 'A1',
      title: `Inglés ${this.options.level ?? 'A1'} · Turismo`,
      content_version: 'v1',
      preview: this.preview,
      // The backend's shape: lessons and activities nested under the module, and a
      // student gets published items only (the server decides, not the client).
      modules: [
        {
          key: 'M1',
          title: 'Módulo I · Primeros pasos',
          lessons: [
            {
              id: 'les1',
              code: '1.1',
              title: 'Presentarse',
              description: 'Saluda y di quién eres.',
              vocabulary_count: 8,
              activities: Object.entries(ACTIVITIES)
                .map(([id, a]) => ({
                  id,
                  skill: a.skill,
                  title: a.title,
                  estimated_minutes: 5,
                  publication_state:
                    this.options.unpublished && id !== 'act-gram' ? 'draft' : 'published',
                  step_count: a.steps.length,
                  role: a.skill === 'dialogue' ? 'Recepcionista' : null,
                  can_do: ['Presentarte en inglés'],
                  state: 'not_started',
                  best_percent: null,
                }))
                .filter((a) => this.preview || a.publication_state === 'published'),
            },
          ],
        },
      ],
    }
  }

  private words() {
    const due = this.options.dueWords ?? 0
    const list = [
      {
        word_id: 'w-hello',
        word: 'hello',
        translation: 'hola',
        box: 1,
        due_at: '2099-01-01T00:00:00Z',
      },
    ]
    for (let i = 0; i < due; i++)
      list.push({
        word_id: `w-due${i}`,
        word: `word${i}`,
        translation: `palabra${i}`,
        box: 1,
        due_at: '2020-01-01T00:00:00Z',
      })
    return list
  }

  private open(activity: string): SessionRecord {
    const session: SessionRecord = {
      id: `00000000-0000-4000-8000-${String(++this.seq).padStart(12, '0')}`,
      activity,
      finished: false,
      tries: [],
      turn: 0,
    }
    this.sessions.set(session.id, session)
    return session
  }

  // SessionView: an exercise with all its steps (answered ones marked), a dialogue with its
  // current turn only.
  private view(session: SessionRecord): unknown {
    const a = ACTIVITIES[session.activity]
    const dialogue = a.kind === 'dialogue'
    return specReply('POST', '/trainer/sessions', 201, {
      session_id: session.id,
      activity_id: session.activity,
      title: a.title,
      status: session.finished ? 'finished' : 'in_progress',
      kind: a.kind,
      steps: dialogue
        ? [a.steps[session.turn]?.step].filter(Boolean)
        : a.steps.map((def) => {
            const last = [...session.tries].reverse().find((t) => t.step === def.step.step_id)
            return { ...def.step, answered: Boolean(last), last_outcome: last?.outcome ?? null }
          }),
      summary: null,
      turn: dialogue ? session.turn + 1 : null,
      turns_total: dialogue ? a.steps.length : null,
    })
  }

  // Returns null for a path that is not a practice one.
  respond(method: string, path: string, body: unknown): PracticeReply | null {
    const o = this.options
    const b = (body ?? {}) as Record<string, unknown>

    if (method === 'GET' && path === '/catalog') {
      this.catalogCalls += 1
      const failing =
        o.catalogStatus !== undefined &&
        (o.catalogFailures === undefined || this.catalogCalls <= o.catalogFailures)
      const answer = (): PracticeReply => {
        if (failing && o.catalogStatus === 0) return { status: 0, body: null, abort: true }
        if (failing)
          return { status: o.catalogStatus!, body: { detail: { code: 'down', message: 'down' } } }
        if (o.catalogBody !== undefined) return { status: 200, body: o.catalogBody }
        if (o.enabled === false)
          return {
            status: 200,
            body: {
              enabled: false,
              ...(o.reason ? { reason: o.reason } : {}),
              preview: this.preview,
            },
          }
        return {
          status: 200,
          body: validated('GET', '/trainer/catalog', 200, this.catalog()),
        }
      }
      return o.catalogHeld
        ? { status: 0, body: null, waitFor: o.catalogHeld, then: answer }
        : answer()
    }

    // There is no route for one activity: the catalog carries what the intro shows.
    if (method === 'POST' && path === '/sessions') {
      const a = ACTIVITIES[String(b.activity_id)]
      if (!a) return { status: 404, body: { detail: 'Not found' } }
      // 201 for a new session, 200 with the one already open for the activity.
      const open = [...this.sessions.values()].find(
        (s) => s.activity === b.activity_id && !s.finished
      )
      const session = open ?? this.open(String(b.activity_id))
      return { status: open ? 200 : 201, body: this.view(session) }
    }

    let m = path.match(/^\/sessions\/([^/]+)\/answers$/)
    if (method === 'POST' && m) {
      const session = this.sessions.get(m[1])
      if (!session) return { status: 404, body: { detail: 'Not found' } }
      const cached = this.answered.get(String(b.attempt_id))
      if (cached) return { status: 200, body: cached }
      if (session.finished)
        return { status: 409, body: { detail: { code: 'finished', message: 'finished' } } }
      if (this.failures < (o.failAnswers ?? 0)) {
        this.failures++
        if (o.failAnswerStatus === 0) return { status: 0, body: null, abort: true }
        return {
          status: o.failAnswerStatus ?? 503,
          body: { detail: { code: 'down', message: 'down' } },
        }
      }
      const a = ACTIVITIES[session.activity]
      const at = a.steps.findIndex((def) => def.step.step_id === b.step_id)
      if (at === -1) return { status: 404, body: { detail: 'Not found' } }
      if (a.kind === 'dialogue' && at !== session.turn)
        return {
          status: 409,
          body: { detail: { code: 'not_current_turn', message: 'not current turn' } },
        }
      this.gradedCount++
      const grade = a.steps[at].grade((b.response ?? {}) as Record<string, unknown>)
      session.tries.push({
        step: String(b.step_id),
        attempt: String(b.attempt_id),
        outcome: grade.outcome,
      })
      const earned = grade.outcome === 'correct' || grade.outcome === 'accepted' ? 1 : 0
      let next: unknown = null
      let finished = false
      if (a.kind === 'dialogue' && grade.outcome === 'accepted') {
        session.turn += 1
        next = a.steps[session.turn]?.step ?? null
        finished = next === null
        if (finished) session.finished = true
      }
      const result = specReply('POST', '/trainer/sessions/{session_id}/answers', 200, {
        outcome: grade.outcome,
        earned,
        total: 1,
        feedback: {
          explanation: grade.explanation ?? null,
          closest_answer: grade.closest ?? null,
          error_tags: grade.tags ?? [],
        },
        next,
        finished,
      })
      this.answered.set(String(b.attempt_id), result)
      return { status: 200, body: result }
    }

    m = path.match(/^\/sessions\/([^/]+)\/finish$/)
    if (method === 'POST' && m) {
      const session = this.sessions.get(m[1])
      if (!session) return { status: 404, body: { detail: 'Not found' } }
      session.finished = true
      const steps = ACTIVITIES[session.activity].steps
      // The first try of each step counts; what was missed is what to revise.
      const first = new Map<string, Grade['outcome']>()
      for (const t of session.tries) if (!first.has(t.step)) first.set(t.step, t.outcome)
      const right = [...first.values()].filter((x) => x === 'correct' || x === 'accepted').length
      return {
        status: 200,
        body: specReply('POST', '/trainer/sessions/{session_id}/finish', 200, {
          session_id: session.id,
          summary: {
            tries: session.tries.length,
            percent: Math.round((right / steps.length) * 100),
            to_revise: right < first.size ? ['article'] : [],
            steps_total: steps.length,
            missed_steps: [...first]
              .filter(([, x]) => x !== 'correct' && x !== 'accepted')
              .map(([k]) => k),
            steps_answered: first.size,
            first_try_correct: right,
          },
        }),
      }
    }

    if (method === 'GET' && path === '/vocabulary') {
      const saved = this.words().filter(
        (w) => this.saved.has(w.word_id) || w.word_id.startsWith('w-due')
      )
      return {
        status: 200,
        body: { saved, due_count: saved.filter((w) => w.due_at < '2025').length },
      }
    }
    m = path.match(/^\/vocabulary\/([^/]+)$/)
    if (m && method === 'PUT') {
      this.saved.add(m[1])
      return { status: 204, body: null }
    }
    if (m && method === 'DELETE') {
      this.saved.delete(m[1])
      return { status: 204, body: null }
    }
    m = path.match(/^\/vocabulary\/([^/]+)\/review$/)
    if (method === 'POST' && m) {
      this.reviews.push({ word: m[1], knew: Boolean(b.knew), attempt: String(b.attempt_id) })
      return { status: 200, body: { box: 2, due_at: '2099-01-01T00:00:00Z' } }
    }

    if (method === 'GET' && path === '/progress')
      return {
        status: 200,
        body: {
          by_skill: [
            { skill: 'grammar', completed: 3, goal: 10 },
            { skill: 'listening', completed: 0, goal: 10 },
          ],
          recent: [
            {
              activity_id: 'act-gram',
              title: 'Verb to be',
              skill: 'grammar',
              finished_at: '2026-11-01T10:00:00Z',
              score: 75,
            },
          ],
        },
      }

    if (method === 'DELETE' && path === '/me') return { status: 204, body: null }
    return null
  }
}
