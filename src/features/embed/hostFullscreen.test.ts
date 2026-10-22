import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { RESERVED_CORNER_PX, getHostFullscreen, setHostFullscreen } from './hostFullscreen.ts'

afterEach(() => setHostFullscreen(false))

describe('host fullscreen', () => {
  it('starts off and follows the host', () => {
    assert.equal(getHostFullscreen(), false)
    setHostFullscreen(true)
    assert.equal(getHostFullscreen(), true)
    setHostFullscreen(false)
    assert.equal(getHostFullscreen(), false)
  })

  it('reserves the 64 px corner of the contract', () => {
    assert.equal(RESERVED_CORNER_PX, 64)
  })
})
