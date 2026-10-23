import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import {
  getContentSupport,
  learnFromBubbles,
  learnFromCreateFailure,
  learnFromCreated,
  resetContentSupport,
} from './contentSupport.ts'

describe('content support detection', () => {
  beforeEach(resetContentSupport)

  it('starts unknown, so an empty map can still offer the feature', () => {
    assert.equal(getContentSupport(), 'unknown')
  })

  it('learns yes from any bubble that carries kind', () => {
    learnFromBubbles([{}, {}])
    assert.equal(getContentSupport(), 'unknown')
    learnFromBubbles([{}, { kind: 'activity' }])
    assert.equal(getContentSupport(), 'yes')
  })

  it('learns no when a content create is refused as a malformed body', () => {
    learnFromCreateFailure({ status: 422, code: 'validation_error' })
    assert.equal(getContentSupport(), 'no')
  })

  it('does not learn no from the content errors a supporting backend sends', () => {
    for (const code of ['content_invalid', 'content_too_large', 'widgets_disabled']) {
      learnFromCreateFailure({ status: 422, code })
      learnFromCreateFailure({ status: 403, code })
      learnFromCreateFailure({ status: 413, code })
    }
    assert.equal(getContentSupport(), 'unknown')
  })

  it('learns no when the created bubble is not content, yes when it is', () => {
    learnFromCreated({})
    assert.equal(getContentSupport(), 'no')
    learnFromCreated({ kind: 'content' })
    assert.equal(getContentSupport(), 'yes')
  })
})
