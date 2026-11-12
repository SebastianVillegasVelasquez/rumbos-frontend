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

describe('the welcome curtain and the music switch', () => {
  const waiting = run([{ type: 'welcome', phase: 'waiting' }])

  it('a click inside the waiting curtain starts nothing and decides nothing', () => {
    const clicked = audioReducer(waiting, { type: 'gesture', autostart: true })
    assert.equal(clicked, waiting)
    assert.equal(isPlaying(clicked), false)
    assert.equal(wantsMusic(clicked), false)
    assert.equal(clicked.gestureSeen, false)
  })

  it('switch off: nothing starts at the primary button', () => {
    const state = run([
      { type: 'welcome', phase: 'waiting' },
      { type: 'mute', muted: true },
      { type: 'welcome', phase: 'started' },
      { type: 'gesture', autostart: false },
    ])
    assert.equal(isPlaying(state), false)
    assert.equal(wantsMusic(state), false)
  })

  it('switch on: it starts at the primary button, not before', () => {
    const on = run([
      { type: 'welcome', phase: 'waiting' },
      { type: 'mute', muted: false },
    ])
    assert.equal(isPlaying(on), false, 'still waiting for the button')
    assert.equal(wantsMusic(on), true)
    const started = [
      { type: 'welcome', phase: 'started' },
      { type: 'gesture', autostart: false },
    ] as const
    assert.equal(isPlaying(started.reduce(audioReducer, on)), true)
  })

  it('the default switch follows the autostart rule at the primary button', () => {
    const started = (autostart: boolean) =>
      run([
        { type: 'welcome', phase: 'waiting' },
        { type: 'welcome', phase: 'started' },
        { type: 'gesture', autostart },
      ])
    assert.equal(isPlaying(started(true)), true)
    assert.equal(isPlaying(started(false)), false)
  })

  it('switch off while music already plays stops it at once', () => {
    const playing = run([{ type: 'gesture', autostart: true }])
    assert.equal(isPlaying(playing), true)
    assert.equal(isPlaying(audioReducer(playing, { type: 'mute', muted: true })), false)
  })

  it('switch on with the gesture already seen resumes at once', () => {
    const off = run([
      { type: 'gesture', autostart: true },
      { type: 'mute', muted: true },
    ])
    assert.equal(isPlaying(off), false)
    assert.equal(isPlaying(audioReducer(off, { type: 'mute', muted: false })), true)
  })

  it('switching on forgets an earlier failure, switching off keeps it', () => {
    const failed = audioReducer(run([{ type: 'toggle' }]), { type: 'failed' })
    assert.equal(audioReducer(failed, { type: 'mute', muted: true }).failed, true)
    assert.equal(audioReducer(failed, { type: 'mute', muted: false }).failed, false)
  })

  it('the HUD button agrees with the switch afterwards', () => {
    const afterCurtain = run([
      { type: 'welcome', phase: 'waiting' },
      { type: 'mute', muted: true },
      { type: 'welcome', phase: 'started' },
      { type: 'gesture', autostart: true },
      { type: 'welcome', phase: 'closed' },
    ])
    assert.equal(wantsMusic(afterCurtain), false)
    assert.equal(wantsMusic(audioReducer(afterCurtain, { type: 'toggle' })), true)
  })
})

describe('audio focus with the welcome video', () => {
  const playing = run([
    { type: 'welcome', phase: 'waiting' },
    { type: 'welcome', phase: 'started' },
    { type: 'gesture', autostart: true },
  ])

  it('the music is paused while the video plays', () => {
    assert.equal(isPlaying(playing), true)
    assert.equal(isPlaying(audioReducer(playing, { type: 'hold', held: true })), false)
  })

  it('it resumes when the video ends or is skipped, if the viewer wants it', () => {
    const held = audioReducer(playing, { type: 'hold', held: true })
    assert.equal(isPlaying(audioReducer(held, { type: 'hold', held: false })), true)
    const unwanted = audioReducer(held, { type: 'mute', muted: true })
    assert.equal(isPlaying(audioReducer(unwanted, { type: 'hold', held: false })), false)
  })

  it('it resumes when the curtain closes with the video still held', () => {
    const held = audioReducer(playing, { type: 'hold', held: true })
    const closed = audioReducer(held, { type: 'welcome', phase: 'closed' })
    assert.equal(closed.held, false)
    assert.equal(isPlaying(closed), true)
  })

  it('never plays while held, whatever else the viewer does', () => {
    let state = audioReducer(playing, { type: 'hold', held: true })
    const noise: AudioEvent[] = [
      { type: 'toggle' },
      { type: 'toggle' },
      { type: 'mute', muted: false },
      { type: 'gesture', autostart: true },
      { type: 'overlay', open: false },
      { type: 'visibility', hidden: false },
      { type: 'trackChanged' },
    ]
    for (const event of noise) {
      state = audioReducer(state, event)
      assert.equal(isPlaying(state), false, `${event.type} must not break the hold`)
    }
  })
})
