// The practice half of contract v2 for the mock server: a catalog, four activities
// (grammar with every step type, listening, writing, a guided dialogue), sessions that
// grade on the "server" side, idempotent answers by attempt_id, a vocabulary box and
// progress. Practice answers DO carry feedback by contract; none of this is the
// assessment (which never does).

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
  // How long the catalog takes to answer, to show the loading state.
  catalogDelayMs?: number
  // Mark the second lesson and the listening activity as not yet published.
  unpublished?: boolean
  // Words due for review.
  dueWords?: number
  // The course's level (a fixture: only A1 has content in production).
  level?: 'A1' | 'A2' | 'B1' | 'B2'
}

export interface PracticeReply {
  status: number
  body: unknown
  abort?: boolean
  // Answer after this delay with what `then` returns.
  delayMs?: number
  then?: () => PracticeReply
}

type StepDef = {
  step: Record<string, unknown>
  grade: (response: Record<string, unknown>) => Grade
}
interface Grade {
  outcome: 'correct' | 'partial' | 'incorrect' | 'accepted'
  explanation?: string
  closest?: string
  tags?: { tag: string; text: string }[]
}

const base = (id: string, type: string, prompt: string, extra: Record<string, unknown>) => ({
  step_id: id,
  type,
  prompt,
  hint: null,
  audio: null,
  ...extra,
})

const ACTIVITIES: Record<string, { title: string; skill: string; steps: StepDef[] }> = {
  'act-gram': {
    title: 'Verb to be',
    skill: 'grammar',
    steps: [
      {
        step: base('g1', 'mcq', 'She ___ a teacher.', {
          options: [
            { option_id: 'a', text: 'am' },
            { option_id: 'b', text: 'is' },
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
                { option_id: 'am', text: 'am' },
                { option_id: 'are', text: 'are' },
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
            { token_id: 't3', text: 'a' },
            { token_id: 't1', text: 'I' },
            { token_id: 't4', text: 'student' },
            { token_id: 't2', text: 'am' },
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
    steps: [
      {
        step: base('s1', 'listen_choose', 'What does she say?', {
          audio: { url: '/__tone.wav', duration_s: 2, transcript: 'Good morning.' },
          options: [
            { option_id: 'a', text: 'Good morning' },
            { option_id: 'b', text: 'Good night' },
          ],
        }),
        grade: (r) => (r.option_id === 'a' ? { outcome: 'correct' } : { outcome: 'incorrect' }),
      },
    ],
  },
  'act-write': {
    title: 'Escribe sobre ti',
    skill: 'writing',
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
                tags: [{ tag: 'article', text: 'Usa a antes de una profesión.' }],
              },
      },
    ],
  },
  'act-dial': {
    title: 'En el hotel',
    skill: 'dialogue',
    steps: [
      {
        step: base('d1', 'dialogue_turn', 'Responde al huésped.', {
          partner_line: {
            text: 'Good evening. Do you have a reservation?',
            translation: 'Buenas noches. ¿Tiene una reserva?',
            audio: null,
          },
          mode: 'choose',
          options: [
            { option_id: 'o1', text: 'Yes, I do.' },
            { option_id: 'o2', text: 'Banana.' },
          ],
          starters: [],
          word_bank: [],
        }),
        grade: (r) =>
          r.option_id === 'o1'
            ? { outcome: 'accepted', explanation: 'Buena respuesta.' }
            : { outcome: 'incorrect', closest: 'Yes, I do.' },
      },
      {
        step: base('d2', 'dialogue_turn', 'Dile tu nombre.', {
          partner_line: { text: 'What is your name?', translation: null, audio: null },
          mode: 'type',
          options: null,
          starters: ['My name is'],
          word_bank: ['Sebastian', 'Ana'],
        }),
        grade: (r) =>
          String(r.text ?? '').trim() !== '' ? { outcome: 'accepted' } : { outcome: 'incorrect' },
      },
    ],
  },
}

export class PracticeMock {
  readonly sessions = new Map<string, { activity: string; index: number }>()
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
      language: { code: 'en', name: 'inglés' },
      level: this.options.level ?? 'A1',
      content_version: 'v1',
      preview: this.preview,
      modules: [{ key: 'M1', title: 'Módulo I · Primeros pasos' }],
      lessons: [
        {
          id: 'les1',
          module: 'M1',
          code: '1.1',
          title: 'Presentarse',
          description: 'Saluda y di quién eres.',
          locked: false,
          ...(this.options.unpublished ? { publication_state: 'published' } : {}),
        },
        {
          id: 'les2',
          module: 'M1',
          code: '1.2',
          title: 'La casa',
          description: 'Habitaciones y objetos.',
          locked: true,
          ...(this.options.unpublished ? { publication_state: 'draft' } : {}),
        },
      ],
      activities: Object.entries(ACTIVITIES).map(([id, a]) => ({
        id,
        lesson_id: 'les1',
        skill: a.skill,
        title: a.title,
        estimated_minutes: 5,
        step_count: a.steps.length,
        locked: false,
        completed_count: 0,
        best_score: null,
        ...(this.options.unpublished
          ? { publication_state: id === 'act-gram' ? 'published' : 'draft' }
          : {}),
      })),
      skills: [
        { skill: 'dialogue', available: true },
        { skill: 'listening', available: true },
        { skill: 'grammar', available: true },
        { skill: 'writing', available: true },
        { skill: 'vocabulary', available: true },
      ],
      suggestion: { activity_id: 'act-gram', reason: 'next' },
      vocab_due: this.options.dueWords ?? 0,
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

  // Returns null for a path that is not a practice one.
  respond(method: string, path: string, body: unknown): PracticeReply | null {
    const o = this.options
    const b = (body ?? {}) as Record<string, unknown>

    if (method === 'GET' && path === '/catalog') {
      this.catalogCalls += 1
      const failing =
        o.catalogStatus !== undefined &&
        (o.catalogFailures === undefined || this.catalogCalls <= o.catalogFailures)
      const delayMs = o.catalogDelayMs
      const answer = (): PracticeReply => {
        if (failing && o.catalogStatus === 0) return { status: 0, body: null, abort: true }
        if (failing) return { status: o.catalogStatus!, body: { detail: { code: 'down' } } }
        if (o.enabled === false)
          return {
            status: 200,
            body: {
              enabled: false,
              ...(o.reason ? { reason: o.reason } : {}),
              ...(o.preview ? { preview: true } : {}),
            },
          }
        return { status: 200, body: this.catalog() }
      }
      return delayMs ? { status: 0, body: null, delayMs, then: answer } : answer()
    }

    let m = path.match(/^\/activities\/([^/]+)$/)
    if (method === 'GET' && m) {
      const a = ACTIVITIES[m[1]]
      if (!a) return { status: 404, body: { detail: { code: 'not_found' } } }
      return {
        status: 200,
        body: {
          id: m[1],
          title: a.title,
          skill: a.skill,
          lesson_id: 'les1',
          role: a.skill === 'dialogue' ? 'Recepcionista' : null,
          can_do: ['Presentarte en inglés'],
          step_count: a.steps.length,
        },
      }
    }

    if (method === 'POST' && path === '/sessions') {
      const a = ACTIVITIES[String(b.activity_id)]
      if (!a) return { status: 404, body: { detail: { code: 'not_found' } } }
      const id = `sess${++this.seq}`
      this.sessions.set(id, { activity: String(b.activity_id), index: 0 })
      return {
        status: 200,
        body: {
          session_id: id,
          preview: this.preview,
          step: a.steps[0].step,
          progress: { index: 1, total: a.steps.length },
        },
      }
    }

    m = path.match(/^\/sessions\/([^/]+)\/answers$/)
    if (method === 'POST' && m) {
      const session = this.sessions.get(m[1])
      if (!session) return { status: 404, body: { detail: { code: 'not_found' } } }
      const cached = this.answered.get(String(b.attempt_id))
      if (cached) return { status: 200, body: cached }
      if (this.failures < (o.failAnswers ?? 0)) {
        this.failures++
        if (o.failAnswerStatus === 0) return { status: 0, body: null, abort: true }
        return { status: o.failAnswerStatus ?? 503, body: { detail: { code: 'down' } } }
      }
      const a = ACTIVITIES[session.activity]
      const def = a.steps[session.index]
      this.gradedCount++
      const grade = def.grade((b.response ?? {}) as Record<string, unknown>)
      session.index += 1
      const next = a.steps[session.index]?.step ?? null
      const result = {
        outcome: grade.outcome,
        feedback: {
          explanation: grade.explanation ?? null,
          closest_answer: grade.closest ?? null,
          error_tags: grade.tags ?? [],
        },
        next_step: next,
        progress: { index: Math.min(session.index + 1, a.steps.length), total: a.steps.length },
      }
      this.answered.set(String(b.attempt_id), result)
      return { status: 200, body: result }
    }

    m = path.match(/^\/sessions\/([^/]+)\/finish$/)
    if (method === 'POST' && m) {
      const session = this.sessions.get(m[1])
      if (!session) return { status: 404, body: { detail: { code: 'not_found' } } }
      const total = ACTIVITIES[session.activity].steps.length
      return {
        status: 200,
        body: {
          score: { correct: total, total },
          went_well: ['Reconoces el verbo to be'],
          to_improve: [
            { tag: 'article', text: 'Recuerda el artículo a.', example: 'I am a student' },
          ],
          new_vocabulary: [{ word_id: 'w-student', word: 'student', translation: 'estudiante' }],
          can_do: ['Presentarte en inglés'],
          next_activity_id: session.activity === 'act-gram' ? 'act-write' : null,
        },
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
