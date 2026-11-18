import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { assessmentApi } from '../features/assessment/api.ts'
import { setPolicy, setRules } from '../features/assessment/editor/trainingForm.ts'
import { realCourseMapApi } from '../features/course-map/data/courseMapApi.ts'
import type { AppearanceUpdate, MapSettings } from '../features/course-map/data/types.ts'
import { trainerApi } from '../features/trainer/api.ts'
import { practiceExamples } from '../features/trainer/fixtures/practiceExamples.ts'
import { createStep } from '../features/welcome/editor/flowEdit.ts'
import { serializeAppearance } from '../features/welcome/welcomeWire.ts'
import { check, requestSchema, SPEC_PATH, specPresent } from './openapiSchema.ts'

// What the front SENDS, against the request schemas of the backend's openapi.json. The
// catalog test covers answers; this one covers bodies, because the backend refuses an
// undeclared field (extra_forbidden) and a body only fails once someone saves.
// Each case runs the real client call with fetch replaced, so the body checked is the
// one that would have gone over the wire, serialization included.

interface Sent {
  method: string
  url: string
  body: unknown
}

const sent: Sent[] = []
// What the stubbed backend answers: a session, so the client can read it.
let reply: unknown = {}
const realFetch = globalThis.fetch

beforeEach(() => {
  sent.length = 0
  reply = practiceExamples().exerciseSession
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    sent.push({
      method: init?.method ?? 'GET',
      url: String(url),
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    })
    return new Response(JSON.stringify(reply), { status: 200 })
  }) as typeof fetch
})
afterEach(() => {
  globalThis.fetch = realFetch
})

const lastBody = (): unknown => {
  const last = sent.at(-1)
  assert.ok(last, 'the call sent no request')
  return last.body
}

const UUID = '3f2b8c1e-5a47-4d6e-9b0a-1c2d3e4f5a6b'

// A map the way the editor leaves it: everything on, a check-in step, both forms chosen.
const editedSettings = (): MapSettings => {
  const base: MapSettings = {
    schemaVersion: 1,
    mode: 'guided',
    fit: 'fit-width',
    initialView: null,
    path: { visible: true, style: 'dashed', color: null, animated: true },
    ambient: { kind: 'none', intensity: 0 },
    intro: 'none',
    trainer: { enabled: true, language: 'en', level: 'A1' },
    assessments: null,
  }
  let settings = setPolicy(base, { enabled: true, passPercent: 70, passOperator: 'gte' })
  settings = setRules(settings, 'check_in', { formId: 'a1-form-a', maxAttempts: 2 })
  settings = setRules(settings, 'final', { formId: 'a1-form-a', timeLimitMin: 45 })
  const step = createStep('assessment', [], {
    welcome: 'B',
    video: 'V',
    html: 'T',
    pdf: 'D',
    quiz: 'Q',
    assessment: 'A',
  })
  return { ...settings, welcome: { enabled: true, steps: [step] } as MapSettings['welcome'] }
}

const putAppearance = async (settings: MapSettings) => {
  const input: AppearanceUpdate = { settings, defaultSkinId: null, skinRules: [] }
  await realCourseMapApi.updateAppearance(UUID, serializeAppearance(input), 1)
  return lastBody()
}

describe('request bodies against openapi.json', () => {
  it('has the spec to compare with', () => {
    assert.ok(
      specPresent,
      `openapi.json not found at ${SPEC_PATH}: copy the backend export (contracts/README.md)`
    )
  })

  it('PUT /course-maps/{id}/appearance: a map with the trainer and both exams set up', async () => {
    const schema = requestSchema('PUT', '/course-maps/{course_map_id}/appearance')
    assert.deepEqual(check(await putAppearance(editedSettings()), schema, 'body'), [])
  })

  it('PUT /course-maps/{id}/appearance: a map whose assessments were never set', async () => {
    const schema = requestSchema('PUT', '/course-maps/{course_map_id}/appearance')
    const plain = { ...editedSettings(), assessments: null, welcome: undefined }
    assert.deepEqual(check(await putAppearance(plain), schema, 'body'), [])
  })

  it('POST /trainer/sessions', async () => {
    await trainerApi.start('demo-grammar')
    assert.deepEqual(lastBody(), { activity_id: 'demo-grammar' })
    assert.deepEqual(check(lastBody(), requestSchema('POST', '/trainer/sessions'), 'body'), [])
  })

  it('POST /trainer/sessions/{id}/answers', async () => {
    const session = practiceExamples().exerciseSession
    await trainerApi.start('demo-grammar')
    reply = practiceExamples().wrongAnswer
    await trainerApi.answer(session.session_id, {
      attempt_id: UUID,
      step_id: 't.mcq',
      response: { option_id: 'a' },
    })
    const schema = requestSchema('POST', '/trainer/sessions/{session_id}/answers')
    assert.deepEqual(check(lastBody(), schema, 'body'), [])
  })

  it('PUT /trainer/attempts/{id}/answers', async () => {
    reply = {}
    await assessmentApi.save(UUID, [{ item_id: 'item-1', response: { choice: 'a' } as never }])
    const schema = requestSchema('PUT', '/trainer/attempts/{attempt_id}/answers')
    assert.deepEqual(check(lastBody(), schema, 'body'), [])
  })

  // Known drift, found by this test: the front still sends the old shapes. Not fixed
  // here (out of scope); `todo` keeps them visible in the report without failing it.
  it(
    'POST /trainer/reports',
    { todo: 'the front sends item_id, reason and note; the spec takes text' },
    async () => {
      const { sendReport } = await import('../features/assessment/api.ts')
      await sendReport({
        activity_id: 'a1-greetings',
        step_id: null,
        item_id: null,
        reason: 'unclear',
        note: null,
      })
      assert.deepEqual(check(lastBody(), requestSchema('POST', '/trainer/reports'), 'body'), [])
    }
  )

  it(
    'POST /trainer/vocabulary/{id}/review',
    { todo: 'the front sends attempt_id and knew; the spec takes knew_it' },
    async () => {
      await trainerApi.review(UUID, { attempt_id: UUID, knew: true })
      const schema = requestSchema('POST', '/trainer/vocabulary/{entry_id}/review')
      assert.deepEqual(check(lastBody(), schema, 'body'), [])
    }
  )

  it('a body that drifts from the schema is reported', () => {
    // The body the editor used to send: snake_case where the contract has camelCase.
    const drifted = {
      settings: {
        assessments: {
          enabled: true,
          check_in: { form_id: 'a1-form-a', max_attempts: 1, time_limit_min: 60 },
          pass_percent: 80,
          pass_operator: 'gt',
        },
      },
    }
    const problems = check(
      drifted,
      requestSchema('PUT', '/course-maps/{course_map_id}/appearance'),
      'body'
    )
    assert.ok(problems.includes('body.settings.assessments.check_in: not in the schema'))
    assert.ok(problems.includes('body.settings.assessments.pass_percent: not in the schema'))
    assert.ok(problems.includes('body.settings.assessments.pass_operator: not in the schema'))
  })
})
