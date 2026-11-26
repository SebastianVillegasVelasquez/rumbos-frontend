import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createTabFullscreenGuard } from './tabFullscreenGuard.ts'

describe('tab fullscreen guard', () => {
  it('asks for the stage back when it fell while another tab was in front', () => {
    const guard = createTabFullscreenGuard(true)
    assert.equal(guard.visibilityChanged(false), null)
    assert.equal(guard.hostChanged(false), null)
    assert.equal(guard.visibilityChanged(true), 'restore')
  })

  it('also covers the host collapsing just before the tab hides', () => {
    // Events arrive in either order: the host first, then the visibility.
    const guard = createTabFullscreenGuard(true)
    guard.hostChanged(false)
    // The stage was already off when the tab went away: that is the viewer's exit.
    assert.equal(guard.visibilityChanged(false), null)
    assert.equal(guard.visibilityChanged(true), null)
  })

  it('leaves the stage alone when it survived the trip', () => {
    const guard = createTabFullscreenGuard(true)
    guard.visibilityChanged(false)
    assert.equal(guard.visibilityChanged(true), null)
  })

  it('never undoes the viewer leaving the stage while looking at the page', () => {
    const guard = createTabFullscreenGuard(true)
    assert.equal(guard.hostChanged(false), null)
    guard.visibilityChanged(false)
    assert.equal(guard.visibilityChanged(true), null)
  })

  it('does nothing when there was no stage to begin with', () => {
    const guard = createTabFullscreenGuard(false)
    guard.visibilityChanged(false)
    assert.equal(guard.visibilityChanged(true), null)
  })

  it('does not restore twice', () => {
    const guard = createTabFullscreenGuard(true)
    guard.visibilityChanged(false)
    guard.hostChanged(false)
    assert.equal(guard.visibilityChanged(true), 'restore')
    assert.equal(guard.visibilityChanged(true), null)
  })
})
