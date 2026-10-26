import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { audioControlMode, isAvailable } from './audioAvailability.ts'
import { audioReducer, initialAudioState, isPlaying } from './audioState.ts'
import { guardSource } from './sourceGuard.ts'

// Stands in for the <audio> element: it only needs to emit `error`.
class FakeAudio extends EventTarget {
  fail() {
    this.dispatchEvent(new Event('error'))
  }
}

const watch = (audio: FakeAudio) => {
  const calls = { retry: 0, fail: 0 }
  const guard = guardSource(audio, {
    retry: () => void calls.retry++,
    fail: () => void calls.fail++,
  })
  return { calls, guard }
}

describe('a failing audio source', () => {
  it('is retried once and then given up on', () => {
    const audio = new FakeAudio()
    const { calls } = watch(audio)
    audio.fail()
    assert.deepEqual(calls, { retry: 1, fail: 0 })
    audio.fail()
    assert.deepEqual(calls, { retry: 1, fail: 1 })
  })

  it('does not retry again however many errors follow', () => {
    const audio = new FakeAudio()
    const { calls } = watch(audio)
    for (let i = 0; i < 20; i++) audio.fail()
    assert.equal(calls.retry, 1)
  })

  it('gets a fresh retry for a different track', () => {
    const audio = new FakeAudio()
    const { calls, guard } = watch(audio)
    audio.fail()
    audio.fail()
    guard.reset()
    audio.fail()
    assert.equal(calls.retry, 2)
  })

  it('stops listening once disposed', () => {
    const audio = new FakeAudio()
    const { calls, guard } = watch(audio)
    guard.dispose()
    audio.fail()
    assert.deepEqual(calls, { retry: 0, fail: 0 })
  })

  it('silences playback until a different track arrives', () => {
    const playing = audioReducer(
      audioReducer(initialAudioState, { type: 'active', active: true }),
      { type: 'gesture', autostart: true }
    )
    assert.equal(isPlaying(playing), true)
    const failed = audioReducer(playing, { type: 'failed' })
    assert.equal(isPlaying(failed), false)
    assert.equal(isPlaying(audioReducer(failed, { type: 'trackChanged' })), true)
  })

  it('never reaches the host', () => {
    for (const file of ['audioSession.ts', 'sourceGuard.ts', 'AudioControl.tsx']) {
      const source = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8')
      assert.doesNotMatch(source, /hostBridge|localErrors|rumbos:error|reportError|escalat/i, file)
    }
  })
})

describe('what each viewer sees when the audio fails', () => {
  it('shows a student nothing at all', () => {
    assert.equal(audioControlMode({ failed: true, diagnostics: false }), 'hidden')
  })

  it('shows an editor or the preview a warning', () => {
    assert.equal(audioControlMode({ failed: true, diagnostics: true }), 'warning')
  })

  it('changes nothing while the audio works', () => {
    assert.equal(audioControlMode({ failed: false, diagnostics: false }), 'normal')
    assert.equal(audioControlMode({ failed: false, diagnostics: true }), 'normal')
  })
})

describe('the backend `available` flag', () => {
  it('only an explicit false marks a track missing', () => {
    assert.equal(isAvailable({ available: false }), false)
    assert.equal(isAvailable({ available: true }), true)
    // An older backend sends nothing: unknown, treated as before.
    assert.equal(isAvailable({}), true)
  })

  it('hides the control from students for a known-missing track, keeps it for editors', () => {
    // The track reaches the session flagged `unavailable`, which fails it at
    // once (see audioSession.setTrack): the same states as a runtime failure.
    const failed = audioReducer(initialAudioState, { type: 'failed' })
    assert.equal(audioControlMode({ failed: failed.failed, diagnostics: false }), 'hidden')
    assert.equal(audioControlMode({ failed: failed.failed, diagnostics: true }), 'warning')
  })
})
