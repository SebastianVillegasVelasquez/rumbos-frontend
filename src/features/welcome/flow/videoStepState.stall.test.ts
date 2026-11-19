import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  initialVideoState,
  showTroubleAction,
  videoCompleted,
  videoReducer,
  type VideoEvent,
} from './videoStepState.ts'

const run = (events: VideoEvent[]) => events.reduce(videoReducer, initialVideoState)

test('a started video that never ends gets the way out after the maximum wait', () => {
  const state = run([{ type: 'click' }, { type: 'signal', signal: 'playing' }, { type: 'stall' }])
  assert.equal(state.phase, 'trouble')
  assert.equal(showTroubleAction(state, true), true)
  assert.equal(videoCompleted(state), false)
})

test('later start signals do not close a way out opened by the maximum wait', () => {
  const state = run([
    { type: 'click' },
    { type: 'signal', signal: 'playing' },
    { type: 'stall' },
    { type: 'signal', signal: 'playing' },
  ])
  assert.equal(state.phase, 'trouble')
})

test('the end still completes after the way out was offered', () => {
  const state = run([
    { type: 'click' },
    { type: 'signal', signal: 'playing' },
    { type: 'stall' },
    { type: 'signal', signal: 'ended' },
  ])
  assert.equal(videoCompleted(state), true)
})

test('a stall before any start signal or after the end changes nothing', () => {
  assert.equal(run([{ type: 'click' }, { type: 'stall' }]).phase, 'loading')
  assert.equal(
    run([{ type: 'click' }, { type: 'signal', signal: 'ended' }, { type: 'stall' }]).phase,
    'ended'
  )
})
