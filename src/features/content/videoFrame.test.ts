import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { videoFrameAttributes } from './videoFrame.ts'

describe('video iframe attributes', () => {
  const attributes = videoFrameAttributes()

  it('delegates exactly autoplay, fullscreen and picture-in-picture', () => {
    assert.equal(attributes.allow, 'autoplay; fullscreen; picture-in-picture')
    assert.equal(attributes.allowFullScreen, true)
  })

  it('keeps the sandbox to the three tokens the player needs', () => {
    assert.deepEqual(attributes.sandbox.split(' ').sort(), [
      'allow-presentation',
      'allow-same-origin',
      'allow-scripts',
    ])
  })

  it('sends a trimmed referrer', () => {
    assert.equal(attributes.referrerPolicy, 'strict-origin-when-cross-origin')
  })
})
