import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { preferredAspectRatio } from './preferredSize.ts'

describe('preferredAspectRatio', () => {
  it('follows the image for the three fitting modes', () => {
    for (const fit of ['fit-width', 'fit-height', 'contain'] as const)
      assert.equal(preferredAspectRatio(fit, { width: 2000, height: 1000 }), 2)
  })

  it('asks for 16/9 for large explorable canvases, image or not', () => {
    assert.equal(preferredAspectRatio('original', null), 16 / 9)
    assert.equal(preferredAspectRatio('original', { width: 4000, height: 4000 }), 16 / 9)
  })

  it('has no answer until the image size is known', () => {
    assert.equal(preferredAspectRatio('contain', null), null)
    assert.equal(preferredAspectRatio('contain', { width: 0, height: 10 }), null)
  })
})
