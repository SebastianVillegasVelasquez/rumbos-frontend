import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  audioReducer,
  initialAudioState,
  isPlaying,
  wantsMusic,
  type AudioEvent,
  type AudioState,
} from './audioState.ts'

const run = (events: AudioEvent[], from: AudioState = initialAudioState) =>
  events.reduce(audioReducer, { ...from, active: true })

describe('audio state', () => {
  it('never plays before a gesture, even if the viewer wanted it', () => {
    assert.equal(isPlaying(run([])), false)
    assert.equal(isPlaying(run([{ type: 'overlay', open: false }])), false)
  })

  it('autostarts after the first gesture only when allowed', () => {
    assert.equal(isPlaying(run([{ type: 'gesture', autostart: true }])), true)
    const refused = run([{ type: 'gesture', autostart: false }])
    assert.equal(isPlaying(refused), false)
    assert.equal(wantsMusic(refused), false)
  })

  it('a viewer who switched it off is not autostarted again', () => {
    const state = run([
      { type: 'gesture', autostart: true },
      { type: 'toggle' },
      { type: 'gesture', autostart: true },
    ])
    assert.equal(isPlaying(state), false)
    assert.equal(wantsMusic(state), false)
  })

  it('the button turns it on and off, and counts as a gesture', () => {
    const on = run([{ type: 'toggle' }])
    assert.equal(isPlaying(on), true)
    assert.equal(isPlaying(audioReducer(on, { type: 'toggle' })), false)
  })

  it('pauses under a host overlay and resumes on close', () => {
    const playing = run([{ type: 'toggle' }])
    const paused = audioReducer(playing, { type: 'overlay', open: true })
    assert.equal(isPlaying(paused), false)
    assert.equal(wantsMusic(paused), true, 'the button still shows it as on')
    assert.equal(isPlaying(audioReducer(paused, { type: 'overlay', open: false })), true)
  })

  it('pauses while the tab is hidden and resumes when it is back', () => {
    const playing = run([{ type: 'toggle' }])
    const hidden = audioReducer(playing, { type: 'visibility', hidden: true })
    assert.equal(isPlaying(hidden), false)
    assert.equal(isPlaying(audioReducer(hidden, { type: 'visibility', hidden: false })), true)
  })

  it('does not resume something the viewer had paused', () => {
    const state = run([
      { type: 'toggle' },
      { type: 'toggle' },
      { type: 'overlay', open: true },
      { type: 'overlay', open: false },
    ])
    assert.equal(isPlaying(state), false)
  })

  it('leaving the stage pauses without forgetting', () => {
    const playing = run([{ type: 'toggle' }])
    const away = audioReducer(playing, { type: 'active', active: false })
    assert.equal(isPlaying(away), false)
    assert.equal(wantsMusic(away), true)
    assert.equal(isPlaying(audioReducer(away, { type: 'active', active: true })), true)
  })

  it('stops on a failure, and a new track gets a fresh try', () => {
    const failed = audioReducer(run([{ type: 'toggle' }]), { type: 'failed' })
    assert.equal(isPlaying(failed), false)
    assert.equal(isPlaying(audioReducer(failed, { type: 'trackChanged' })), true)
  })

  it('keeps wanting music across a track change', () => {
    const state = audioReducer(run([{ type: 'toggle' }]), { type: 'trackChanged' })
    assert.equal(isPlaying(state), true)
  })
})

describe('autostart announcement and the welcome video hold', () => {
  it('flags only a start the viewer did not ask for', () => {
    assert.equal(run([{ type: 'gesture', autostart: true }]).autostarted, true)
    assert.equal(run([{ type: 'gesture', autostart: false }]).autostarted, false)
    assert.equal(run([{ type: 'toggle' }]).autostarted, false)
  })

  it('waits while the welcome video plays and resumes after', () => {
    const started = run([{ type: 'gesture', autostart: true }])
    const held = audioReducer(started, { type: 'hold', held: true })
    assert.equal(isPlaying(held), false)
    assert.equal(wantsMusic(held), true)
    assert.equal(isPlaying(audioReducer(held, { type: 'hold', held: false })), true)
  })
})
