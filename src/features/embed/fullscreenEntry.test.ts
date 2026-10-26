import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { fullscreenEntry } from './fullscreenEntry.ts'

const base = { embedded: false, hostFullscreen: false, browserFullscreen: false, browserApi: false }

describe('fullscreenEntry', () => {
  it('asks the host when embedded, and steps aside while the host is fullscreen', () => {
    assert.equal(fullscreenEntry({ ...base, embedded: true }), 'host')
    assert.equal(fullscreenEntry({ ...base, embedded: true, hostFullscreen: true }), null)
  })

  it('shows again when the host ends fullscreen, whatever the way out', () => {
    const on = { ...base, embedded: true, hostFullscreen: true }
    assert.equal(fullscreenEntry(on), null)
    assert.equal(fullscreenEntry({ ...on, hostFullscreen: false }), 'host')
  })

  it('ignores the browser API when embedded', () => {
    assert.equal(fullscreenEntry({ ...base, embedded: true, browserApi: true }), 'host')
  })

  it('uses the Fullscreen API standalone, and hides without it', () => {
    assert.equal(fullscreenEntry({ ...base, browserApi: true }), 'browser')
    assert.equal(fullscreenEntry({ ...base, browserApi: false }), null)
    assert.equal(fullscreenEntry({ ...base, browserApi: true, browserFullscreen: true }), null)
  })
})
