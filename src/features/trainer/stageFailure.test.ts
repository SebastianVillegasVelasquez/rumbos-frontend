import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ContractError } from '../course-map/data/contract.ts'
import { describeStageFailure } from './stageFailure.ts'

describe('describeStageFailure', () => {
  it('names the endpoint and fields of a contract failure', () => {
    const failure = describeStageFailure(
      new ContractError('GET /trainer/catalog', ['modules: expected an array, got undefined'])
    )
    assert.equal(failure.kind, 'contract')
    assert.equal(failure.endpoint, 'GET /trainer/catalog')
    assert.deepEqual(failure.issues, ['modules: expected an array, got undefined'])
  })

  it('tells a chunk that would not download from a render error', () => {
    for (const message of [
      'Failed to fetch dynamically imported module: https://x/assets/TrainerStage-1.js',
      'Importing a module script failed.',
    ])
      assert.equal(describeStageFailure(new TypeError(message)).kind, 'chunk')
    const render = describeStageFailure(
      new TypeError("Cannot read properties of undefined (reading 'find')")
    )
    assert.equal(render.kind, 'render')
    assert.match(render.message, /reading 'find'/)
  })

  it('copes with something that is not an Error', () => {
    assert.deepEqual(describeStageFailure('boom'), {
      kind: 'render',
      name: 'string',
      message: 'boom',
    })
  })
})
