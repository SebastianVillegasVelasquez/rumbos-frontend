import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ApiError } from '../data/apiError.ts'
import { es } from '../../../i18n/es.ts'
import { describeSaveFailure } from './appearanceErrors.ts'

const say = (error: unknown) => describeSaveFailure(error, es.studio.saveFailure)

describe('describing a failed save', () => {
  it('shows the problem and its path for the real 422 of production', () => {
    const body = {
      detail: {
        code: 'welcome_invalid',
        message: 'The welcome curtain settings are not valid',
        problems: [
          {
            path: 'welcome.playOnEnter',
            code: 'legacy_fields_with_steps',
            message: 'Leave this empty: when steps are defined they define the flow',
          },
        ],
      },
    }
    const text = say(new ApiError(422, body))
    assert.match(text, /deben quedar vacíos/)
    assert.match(text, /welcome\.playOnEnter/)
    assert.notEqual(text, es.studio.saveError)
  })

  it('falls back to the server text for an unknown problem code', () => {
    const text = say(
      new ApiError(422, {
        detail: {
          code: 'welcome_invalid',
          message: 'x',
          problems: [{ path: 'welcome.show', code: 'new_code', message: 'Server words' }],
        },
      })
    )
    assert.match(text, /Server words/)
    assert.match(text, /welcome\.show/)
  })

  it('names the code when a 422 has no problems', () =>
    assert.match(
      say(new ApiError(422, { detail: { code: 'welcome_invalid', message: 'x' } })),
      /welcome_invalid/
    ))

  it('is specific for 409, 412, 5xx and the network, with the code', () => {
    assert.match(
      say(new ApiError(409, { detail: { code: 'revision_conflict', message: 'x' } })),
      /otra persona|alguien más.*revision_conflict/is
    )
    assert.match(
      say(new ApiError(412, { detail: { code: 'precondition_failed', message: 'x' } })),
      /desactualizada.*precondition_failed/
    )
    assert.match(
      say(new ApiError(503, { detail: { code: 'upstream_down', message: 'x' } })),
      /503.*upstream_down/
    )
    assert.match(say(new ApiError(500, 'Internal Server Error')), /500.*unknown_error/)
    assert.match(say(new ApiError(0, undefined)), /conexión/)
  })

  it('never returns only the generic message', () => {
    for (const status of [0, 400, 404, 409, 412, 422, 428, 500, 502])
      assert.notEqual(say(new ApiError(status, undefined)), es.studio.saveError)
    assert.notEqual(say(new Error('boom')), es.studio.saveError)
  })
})
