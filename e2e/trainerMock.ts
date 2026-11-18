import type { BrowserContext, Route } from '@playwright/test'
import { makeWav } from './audioFixture.ts'
import { PracticeMock, type PracticeOptions } from './practiceMock.ts'

// An in-memory implementation of the assessment half of contract v2
// (`/api/v1/trainer`), served to the browser through Playwright's routing. It is a
// mock server, not a stub of the app: the app makes real fetch calls and gets real
// status codes, shapes and failures. It never sends keys or correctness (and the
// `leak` option exists only to prove the app refuses a response that does).

export interface MockOptions {
  enabled?: boolean
  preview?: boolean
  maxAttempts?: number
  timeLimitMs?: number
  passPercent?: number
  operator?: 'gt' | 'gte'
  // The list answers this status (503, 404...) instead of the list.
  listStatus?: number
  // The first N save calls fail with this status (0 = the connection drops).
  failSaves?: number
  failSaveStatus?: number
  // Every save is a 401, even after a token refresh.
  unauthorizedSaves?: boolean
  // After a pass: the sync states the result goes through, one per read.
  sync?: ('pending' | 'synced' | 'failed' | 'not_required')[]
  // Put a forbidden field in the section payload.
  leak?: boolean
  // The first N submits fail.
  failSubmits?: number
  // A state to report for the check-in in the list.
  state?: 'available' | 'exhausted' | 'locked' | 'passed'
  // The practice half (catalog, sessions, vocabulary); see practiceMock.ts.
  practice?: PracticeOptions
}

export interface Call {
  method: string
  path: string
  body: unknown
}

interface Attempt {
  id: string
  purpose: string
  startedAt: number
  deadline: number
  answers: Map<string, unknown>
  status: 'in_progress' | 'submitted' | 'expired'
  result?: ReturnType<TrainerMock['buildResult']>
  reads: number
}

const SECTIONS = [
  { key: 'listening', title: 'Listening', instructions: 'Escucha y responde.' },
  { key: 'reading', title: 'Reading', instructions: 'Lee el texto.' },
  { key: 'use_of_english', title: 'Use of English', instructions: 'Elige la opción.' },
  { key: 'writing', title: 'Writing', instructions: 'Escribe.' },
  { key: 'speaking', title: 'Speaking', instructions: 'Responde por escrito.' },
] as const

const opts = (id: string) => [
  { option_id: `${id}a`, text: 'Option A' },
  { option_id: `${id}b`, text: 'Option B' },
  { option_id: `${id}c`, text: 'Option C' },
]

const audio = { url: '/__tone.wav', duration_s: 1 }

// Item counts as scored: match_audio spans two numbers here.
const BODY: Record<string, { item_count: number; parts: unknown[] }> = {
  listening: {
    item_count: 4,
    parts: [
      {
        part_key: 'A',
        instructions: 'Listen and choose.',
        shared: null,
        items: [
          {
            item_id: 'l1',
            type: 'listen_choose',
            prompt: 'Where is the speaker?',
            audio,
            options: opts('l1'),
          },
          {
            item_id: 'l2',
            type: 'match_audio',
            prompt: 'Match each audio with a place.',
            clips: [
              { id: 'c1', audio },
              { id: 'c2', audio },
            ],
            places: [
              { id: 'p1', text: 'Hotel reception' },
              { id: 'p2', text: 'Restaurant table' },
            ],
          },
          { item_id: 'l3', type: 'mcq', prompt: 'What time is it?', options: opts('l3') },
        ],
      },
    ],
  },
  reading: {
    item_count: 2,
    parts: [
      {
        part_key: 'A',
        instructions: 'Read the signs.',
        shared: { sign: 'No smoking' },
        items: [
          { item_id: 'r1', type: 'mcq', prompt: 'What does the sign say?', options: opts('r1') },
        ],
      },
      {
        part_key: 'B',
        instructions: 'Read the passage.',
        shared: { passage: 'Ana arrives at the hotel at six.\nShe asks for a quiet room.' },
        items: [
          { item_id: 'r2', type: 'mcq', prompt: 'When does Ana arrive?', options: opts('r2') },
        ],
      },
    ],
  },
  use_of_english: {
    item_count: 2,
    parts: [
      {
        part_key: 'A',
        instructions: 'Choose the word.',
        shared: null,
        items: [
          {
            item_id: 'u1',
            type: 'gap_choice',
            prompt: 'Complete.',
            gap_label: 'She ___ a student.',
            options: opts('u1'),
          },
          {
            item_id: 'u2',
            type: 'gap_choice',
            prompt: 'Complete.',
            gap_label: 'They ___ happy.',
            options: opts('u2'),
          },
        ],
      },
    ],
  },
  writing: {
    item_count: 2,
    parts: [
      {
        part_key: 'A',
        instructions: 'Fill the form.',
        shared: null,
        items: [
          {
            item_id: 'w1',
            type: 'form_fields',
            prompt: 'Hotel form',
            fields: [
              { field_id: 'name', label: 'Name' },
              { field_id: 'country', label: 'Country' },
            ],
          },
          {
            item_id: 'w2',
            type: 'template_text',
            prompt: 'Write a short message.',
            template: 'Hello {name}, I am {age} years old.',
            min_words: 8,
            max_words: 12,
          },
        ],
      },
    ],
  },
  speaking: {
    item_count: 2,
    parts: [
      {
        part_key: 'A',
        instructions: 'Answer in writing.',
        shared: null,
        items: [
          {
            item_id: 's1',
            type: 'written_answers',
            prompt: 'About you',
            questions: [
              { q_id: 'q1', prompt: 'What is your name?' },
              { q_id: 'q2', prompt: 'Where are you from?' },
            ],
          },
        ],
      },
    ],
  },
}

export const TOTAL_ITEMS = SECTIONS.reduce((sum, s) => sum + BODY[s.key].item_count, 0)

export class TrainerMock {
  readonly calls: Call[] = []
  readonly responses: string[] = []
  readonly attempts = new Map<string, Attempt>()
  private used = 0
  private saveFailures = 0
  private submitFailures = 0
  private seq = 0

  readonly options: MockOptions
  readonly practice: PracticeMock

  constructor(options: MockOptions = {}) {
    this.options = options
    this.practice = new PracticeMock(options.practice)
  }

  get opts(): Required<
    Pick<MockOptions, 'enabled' | 'maxAttempts' | 'timeLimitMs' | 'passPercent' | 'operator'>
  > {
    return {
      enabled: this.options.enabled ?? true,
      maxAttempts: this.options.maxAttempts ?? 1,
      timeLimitMs: this.options.timeLimitMs ?? 60 * 60_000,
      passPercent: this.options.passPercent ?? 80,
      operator: this.options.operator ?? 'gt',
    }
  }

  async install(context: BrowserContext): Promise<void> {
    const wav = makeWav(2)
    // Answered by range, as the real backend does: WebKit refuses media it cannot
    // read by range.
    await context.route('**/__tone.wav', (route) => {
      const range = /^bytes=(\d+)-(\d*)$/.exec(route.request().headers()['range'] ?? '')
      const headers = { 'Content-Type': 'audio/wav', 'Accept-Ranges': 'bytes' }
      if (!range) return route.fulfill({ status: 200, body: wav, headers })
      const start = Number(range[1])
      const end = Math.min(range[2] ? Number(range[2]) : wav.length - 1, wav.length - 1)
      return route.fulfill({
        status: 206,
        body: wav.subarray(start, end + 1),
        headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${wav.length}` },
      })
    })
    await context.route('**/api/v1/trainer/**', (route) => this.handle(route))
  }

  private json(route: Route, status: number, body: unknown) {
    const text = JSON.stringify(body)
    this.responses.push(text)
    return route.fulfill({ status, contentType: 'application/json', body: text })
  }

  private err(route: Route, status: number, code: string) {
    return this.json(route, status, { detail: { code, message: code } })
  }

  private best() {
    const done = [...this.attempts.values()].filter((a) => a.result)
    if (done.length === 0) return null
    const top = done.reduce((a, b) =>
      Number(a.result!.percent) >= Number(b.result!.percent) ? a : b
    )
    return {
      percent: top.result!.percent,
      passed: top.result!.passed,
      finished_at: new Date().toISOString(),
    }
  }

  private active() {
    return [...this.attempts.values()].find((a) => a.status === 'in_progress') ?? null
  }

  buildResult(attempt: Attempt, status: 'submitted' | 'expired') {
    const answered = this.answeredPoints(attempt)
    const percent = ((answered / TOTAL_ITEMS) * 100).toFixed(2)
    const p = Number(percent)
    const { passPercent, operator } = this.opts
    const passed = operator === 'gt' ? p > passPercent : p >= passPercent
    const states = this.options.sync ?? ['not_required']
    const sync = passed ? states[Math.min(attempt.reads, states.length - 1)] : 'not_required'
    return {
      status,
      percent,
      passed,
      band: p >= 80 ? 'achieved' : p >= 60 ? 'consolidating' : p >= 40 ? 'developing' : 'emerging',
      by_section: SECTIONS.map((s) => ({
        key: s.key,
        points: 0,
        max: BODY[s.key].item_count,
        percent: percent,
        weight: 20,
      })),
      by_module: [
        { module: 'M1', percent },
        { module: 'M2', percent },
      ],
      attempts: { used: this.used, max: this.opts.maxAttempts },
      gain: null,
      sync: { state: sync },
    }
  }

  // Points are the number of answered items (the mock does not grade).
  private answeredPoints(attempt: Attempt) {
    let points = 0
    for (const [id, response] of attempt.answers) {
      const match = /^l2$/.test(id) ? ((response as { pairs?: unknown[] }).pairs?.length ?? 0) : 1
      points += match
    }
    return Math.min(points, TOTAL_ITEMS)
  }

  private expireIfLate(attempt: Attempt) {
    if (attempt.status === 'in_progress' && Date.now() >= attempt.deadline) {
      attempt.status = 'expired'
      attempt.result = this.buildResult(attempt, 'expired')
    }
  }

  private async handle(route: Route) {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace(/^.*\/api\/v1\/trainer/, '')
    const method = request.method()
    let body: unknown
    try {
      body = request.postDataJSON()
    } catch {
      body = undefined
    }
    this.calls.push({ method, path, body })
    const o = this.options

    let practice = this.practice.respond(method, path, body)
    if (practice?.delayMs && practice.then) {
      await new Promise((resolve) => setTimeout(resolve, practice!.delayMs))
      practice = practice.then()
    }
    if (practice) {
      if (practice.abort) return route.abort('connectionfailed')
      if (practice.body === null) return route.fulfill({ status: practice.status, body: '' })
      return this.json(route, practice.status, practice.body)
    }

    if (method === 'GET' && path === '/assessments') {
      if (o.listStatus) return this.err(route, o.listStatus, 'down')
      const active = this.active()
      if (active) this.expireIfLate(active)
      const live = this.active()
      return this.json(route, 200, {
        enabled: this.opts.enabled,
        preview: o.preview ?? false,
        policy: {
          pass_percent: this.opts.passPercent,
          pass_operator: this.opts.operator,
          time_limit_min: Math.round(this.opts.timeLimitMs / 60_000),
        },
        items: (['check_in', 'final'] as const).map((purpose) => ({
          purpose,
          title: purpose === 'final' ? 'Evaluación final' : 'Evaluación de entrada',
          section_count: SECTIONS.length,
          item_count: TOTAL_ITEMS,
          attempts: { used: this.used, max: this.opts.maxAttempts },
          state:
            o.state ??
            (live ? 'in_progress' : this.used >= this.opts.maxAttempts ? 'exhausted' : 'available'),
          locked_reason: o.state === 'locked' ? 'Termina primero el módulo 1.' : null,
          in_progress: live
            ? { attempt_id: live.id, deadline_at: new Date(live.deadline).toISOString() }
            : null,
          best: this.best(),
        })),
      })
    }

    let match = path.match(/^\/assessments\/(check_in|final)\/attempts$/)
    if (method === 'POST' && match) {
      const live = this.active()
      if (live) this.expireIfLate(live)
      const again = this.active()
      if (again) return this.json(route, 200, this.startBody(again))
      if (this.used >= this.opts.maxAttempts) return this.err(route, 409, 'no_attempts_left')
      this.used++
      const now = Date.now()
      const attempt: Attempt = {
        id: `att${++this.seq}`,
        purpose: match[1],
        startedAt: now,
        deadline: now + this.opts.timeLimitMs,
        answers: new Map(),
        status: 'in_progress',
        reads: 0,
      }
      this.attempts.set(attempt.id, attempt)
      return this.json(route, 201, this.startBody(attempt))
    }

    match = path.match(/^\/attempts\/([^/]+)\/sections\/([^/]+)$/)
    if (method === 'GET' && match) {
      const attempt = this.attempts.get(match[1])
      const section = SECTIONS.find((s) => s.key === match![2])
      if (!attempt || !section) return this.err(route, 404, 'not_found')
      this.expireIfLate(attempt)
      const saved: Record<string, unknown> = {}
      const ids = new Set(
        (BODY[section.key].parts as { items: { item_id: string }[] }[]).flatMap((p) =>
          p.items.map((i) => i.item_id)
        )
      )
      for (const [id, value] of attempt.answers) if (ids.has(id)) saved[id] = value
      const payload: Record<string, unknown> = {
        key: section.key,
        title: section.title,
        deadline_at: new Date(attempt.deadline).toISOString(),
        server_now: new Date().toISOString(),
        parts: BODY[section.key].parts,
        saved,
      }
      if (o.leak) payload.answer_key = { l1: 'l1b' }
      return this.json(route, 200, payload)
    }

    match = path.match(/^\/attempts\/([^/]+)\/answers$/)
    if (method === 'PUT' && match) {
      if (o.unauthorizedSaves) return this.err(route, 401, 'expired_session')
      if (this.saveFailures < (o.failSaves ?? 0)) {
        this.saveFailures++
        if (o.failSaveStatus === 0) return route.abort('connectionfailed')
        return this.err(route, o.failSaveStatus ?? 503, 'down')
      }
      const attempt = this.attempts.get(match[1])
      if (!attempt) return this.err(route, 404, 'not_found')
      this.expireIfLate(attempt)
      if (attempt.status !== 'in_progress')
        return this.err(route, 409, attempt.status === 'expired' ? 'expired' : 'submitted')
      for (const { item_id, response } of (
        body as { answers: { item_id: string; response: unknown }[] }
      ).answers)
        attempt.answers.set(item_id, response)
      return this.json(route, 200, {
        saved_at: new Date().toISOString(),
        server_now: new Date().toISOString(),
        deadline_at: new Date(attempt.deadline).toISOString(),
      })
    }

    match = path.match(/^\/attempts\/([^/]+)\/submit$/)
    if (method === 'POST' && match) {
      const attempt = this.attempts.get(match[1])
      if (!attempt) return this.err(route, 404, 'not_found')
      if (this.submitFailures < (o.failSubmits ?? 0)) {
        this.submitFailures++
        return this.err(route, 503, 'down')
      }
      this.expireIfLate(attempt)
      if (attempt.status === 'in_progress') {
        attempt.status = 'submitted'
        attempt.result = this.buildResult(attempt, 'submitted')
      }
      return this.json(route, 200, attempt.result)
    }

    match = path.match(/^\/attempts\/([^/]+)\/result$/)
    if (method === 'GET' && match) {
      const attempt = this.attempts.get(match[1])
      if (!attempt?.result) return this.err(route, 404, 'not_found')
      attempt.reads++
      attempt.result = this.buildResult(
        attempt,
        attempt.status === 'expired' ? 'expired' : 'submitted'
      )
      return this.json(route, 200, attempt.result)
    }

    if (method === 'POST' && path === '/reports') return route.fulfill({ status: 201, body: '' })

    return this.err(route, 404, 'not_found')
  }

  private startBody(attempt: Attempt) {
    return {
      attempt_id: attempt.id,
      started_at: new Date(attempt.startedAt).toISOString(),
      deadline_at: new Date(attempt.deadline).toISOString(),
      server_now: new Date().toISOString(),
      sections: SECTIONS.map((s) => ({
        key: s.key,
        title: s.title,
        instructions: s.instructions,
        item_count: BODY[s.key].item_count,
      })),
    }
  }
}
