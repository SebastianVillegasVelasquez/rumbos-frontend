import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { wantsFullStage } from './stagePolicy.ts'

describe('where the welcome flow shows', () => {
  it('takes the full stage while a mandatory flow is unfinished inside the host', () => {
    assert.equal(wantsFullStage({ embedded: true, mode: 'normal', hasMandatoryStep: true }), true)
  })

  it('stays inline for the editor preview and for a review', () => {
    for (const mode of ['preview', 'review'] as const)
      assert.equal(wantsFullStage({ embedded: true, mode, hasMandatoryStep: true }), false, mode)
  })

  it('stays inline when nothing in it is mandatory', () => {
    assert.equal(wantsFullStage({ embedded: true, mode: 'normal', hasMandatoryStep: false }), false)
  })

  it('has no frame to grow outside the host', () => {
    assert.equal(wantsFullStage({ embedded: false, mode: 'normal', hasMandatoryStep: true }), false)
  })
})
