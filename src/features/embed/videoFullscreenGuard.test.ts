import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createVideoFullscreenGuard, VIDEO_FULLSCREEN_WINDOW_MS } from './videoFullscreenGuard.ts'

const clock = () => {
  let t = 0
  return { now: () => t, advance: (ms: number) => void (t += ms) }
}

describe('the stage survives a video leaving its own fullscreen', () => {
  it('restores it when the host collapses right after the video ends', () => {
    const c = clock()
    const guard = createVideoFullscreenGuard(true, c.now)
    assert.equal(guard.videoFullscreenChanged(true), null)
    assert.equal(guard.videoFullscreenChanged(false), null)
    c.advance(100)
    assert.equal(guard.hostChanged(false), 'restore')
  })

  it('restores it when the host collapses before this document sees the video end', () => {
    const c = clock()
    const guard = createVideoFullscreenGuard(true, c.now)
    guard.videoFullscreenChanged(true)
    assert.equal(guard.hostChanged(false), null)
    assert.equal(guard.videoFullscreenChanged(false), 'restore')
  })

  it('restores it once, and not again for a later exit', () => {
    const c = clock()
    const guard = createVideoFullscreenGuard(true, c.now)
    guard.videoFullscreenChanged(true)
    guard.videoFullscreenChanged(false)
    assert.equal(guard.hostChanged(false), 'restore')
    assert.equal(guard.hostChanged(true), null)
    c.advance(10_000)
    assert.equal(guard.hostChanged(false), null)
  })

  it('leaves the viewer who closes the stage long after the video alone', () => {
    const c = clock()
    const guard = createVideoFullscreenGuard(true, c.now)
    guard.videoFullscreenChanged(true)
    guard.videoFullscreenChanged(false)
    c.advance(VIDEO_FULLSCREEN_WINDOW_MS + 1)
    assert.equal(guard.hostChanged(false), null)
  })

  it('does nothing when the stage was not on before the video', () => {
    const c = clock()
    const guard = createVideoFullscreenGuard(false, c.now)
    guard.videoFullscreenChanged(true)
    guard.videoFullscreenChanged(false)
    assert.equal(guard.hostChanged(false), null)
  })

  it('does not pull the viewer back in when they leave the stage with no video', () => {
    const guard = createVideoFullscreenGuard(true, clock().now)
    assert.equal(guard.hostChanged(false), null)
  })

  it('does nothing when the stage stays on through the video', () => {
    const guard = createVideoFullscreenGuard(true, clock().now)
    assert.equal(guard.videoFullscreenChanged(true), null)
    assert.equal(guard.videoFullscreenChanged(false), null)
  })

  it('ignores a repeated fullscreen signal', () => {
    const guard = createVideoFullscreenGuard(true, clock().now)
    guard.videoFullscreenChanged(true)
    assert.equal(guard.videoFullscreenChanged(true), null)
  })
})
