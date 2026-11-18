import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { assessmentApi, sendReport } from '../features/assessment/api.ts'
import { trainerApi } from '../features/trainer/api.ts'
import { specPresent, specServes } from './openapiSchema.ts'

// Every request the trainer and assessment clients make goes to a route the backend's
// openapi.json declares. A route that is not there answers 404 in production, which the
// screens cannot tell from "closed": GET /trainer/activities/{id} and
// GET /trainer/assessments/forms were both called for a while and never existed.

const sent: { method: string; url: string }[] = []
const realFetch = globalThis.fetch

beforeEach(() => {
  sent.length = 0
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    sent.push({ method: init?.method ?? 'GET', url: String(url) })
    return new Response('{}', { status: 200 })
  }) as typeof fetch
})
afterEach(() => {
  globalThis.fetch = realFetch
})

const ID = '3f2b8c1e-5a47-4d6e-9b0a-1c2d3e4f5a6b'
const calls: Record<string, () => Promise<unknown>> = {
  'trainerApi.catalog': () => trainerApi.catalog(),
  'trainerApi.start': () => trainerApi.start('a1-greetings'),
  'trainerApi.answer': () =>
    trainerApi.answer(ID, { attempt_id: ID, step_id: 's1', response: {} as never }),
  'trainerApi.finish': () => trainerApi.finish(ID),
  'trainerApi.vocabulary': () => trainerApi.vocabulary(),
  'trainerApi.saveWord': () => trainerApi.saveWord(ID),
  'trainerApi.removeWord': () => trainerApi.removeWord(ID),
  'trainerApi.review': () => trainerApi.review(ID, { attempt_id: ID, knew: true }),
  'trainerApi.progress': () => trainerApi.progress(),
  'trainerApi.deleteMine': () => trainerApi.deleteMine(),
  'assessmentApi.list': () => assessmentApi.list(),
  'assessmentApi.start': () => assessmentApi.start('check_in'),
  'assessmentApi.section': () => assessmentApi.section(ID, 'listening'),
  'assessmentApi.save': () => assessmentApi.save(ID, []),
  'assessmentApi.submit': () => assessmentApi.submit(ID),
  'assessmentApi.result': () => assessmentApi.result(ID),
  sendReport: () =>
    sendReport({ activity_id: 'a', step_id: null, item_id: null, reason: 'other', note: null }),
}

describe('routes the front calls against openapi.json', () => {
  it('has the spec to compare with', () => {
    assert.ok(specPresent, 'openapi.json not found: copy the backend export (contracts/README.md)')
  })

  it('lists every method of the trainer and assessment clients', () => {
    const named = Object.keys(calls).filter((name) => name !== 'sendReport')
    const actual = [
      ...Object.keys(trainerApi).map((name) => `trainerApi.${name}`),
      ...Object.keys(assessmentApi).map((name) => `assessmentApi.${name}`),
    ]
    assert.deepEqual(named.sort(), actual.sort(), 'add the new method to `calls`')
  })

  for (const [name, call] of Object.entries(calls))
    it(`${name} calls a route the spec declares`, async () => {
      await call().catch(() => undefined)
      assert.equal(sent.length, 1, `${name} made ${sent.length} requests`)
      const [request] = sent
      assert.ok(request)
      assert.ok(
        specServes(request.method, request.url),
        `${request.method} ${request.url} is not a route in the spec`
      )
    })

  it('a route the spec lacks is reported', () => {
    assert.equal(specServes('GET', '/api/v1/trainer/activities/a1-greetings'), false)
    assert.equal(specServes('GET', '/api/v1/trainer/assessments/forms'), false)
    assert.equal(specServes('GET', '/api/v1/trainer/catalog?x=1'), true)
    assert.equal(specServes('POST', '/api/v1/trainer/catalog'), false)
  })
})
