import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  initialVideoState,
  showTroubleAction,
  takeVideoFallback,
  videoCompleted,
  videoReducer,
  type VideoEvent,
  type VideoState,
} from './videoStepState.ts'

const run = (...events: VideoEvent[]): VideoState => events.reduce(videoReducer, initialVideoState)
const click: VideoEvent = { type: 'click' }
const timeout: VideoEvent = { type: 'timeout' }
const signal = (value: Extract<VideoEvent, { type: 'signal' }>['signal']): VideoEvent => ({
  type: 'signal',
  signal: value,
})

describe('video step phases', () => {
  it('nothing happens before the click', () => {
    assert.equal(run(signal('ready')).phase, 'idle')
    assert.equal(run(timeout).phase, 'idle')
    assert.equal(run(signal('ended')).phase, 'idle')
  })

  it('a start signal in time means no trouble, even if the timeout fires later', () => {
    assert.equal(run(click, signal('ready'), timeout).phase, 'started')
    assert.equal(run(click, signal('playing'), timeout).phase, 'started')
  })

  it('a long video that keeps playing is never in trouble', () => {
    const state = run(click, signal('ready'), signal('playing'), timeout, timeout)
    assert.equal(state.phase, 'started')
    assert.equal(showTroubleAction(state, true), false)
    assert.equal(videoCompleted(state), false)
  })

  it('no start signal by the timeout is trouble, and shows the action only with allowFallback', () => {
    const state = run(click, timeout)
    assert.equal(state.phase, 'trouble')
    assert.equal(showTroubleAction(state, true), true)
    assert.equal(showTroubleAction(state, false), false)
  })

  it('a reported error is trouble at any time after the click', () => {
    assert.equal(run(click, signal('error')).phase, 'trouble')
    assert.equal(run(click, signal('playing'), signal('error')).phase, 'trouble')
  })

  it('a late signal recovers a video declared in trouble', () => {
    assert.equal(run(click, timeout, signal('playing')).phase, 'started')
  })

  it('ended is the only way to complete with working events, and it is final', () => {
    const ended = run(click, signal('playing'), signal('ended'))
    assert.equal(videoCompleted(ended), true)
    assert.equal(videoReducer(ended, signal('playing')).phase, 'ended')
    assert.equal(videoReducer(ended, signal('error')).phase, 'ended')
    assert.equal(videoReducer(ended, timeout).phase, 'ended')
  })

  it('the way out records the fallback, and only from the trouble state', () => {
    assert.equal(takeVideoFallback(run(click, signal('playing'))).usedFallback, false)
    assert.equal(takeVideoFallback(run(click)).usedFallback, false)
    const used = takeVideoFallback(run(click, timeout))
    assert.equal(used.usedFallback, true)
    assert.equal(videoCompleted(used), true)
    assert.equal(showTroubleAction(used, true), false)
  })

  it('a second click does nothing', () => {
    assert.deepEqual(run(click, signal('ready'), click), run(click, signal('ready')))
  })
})
