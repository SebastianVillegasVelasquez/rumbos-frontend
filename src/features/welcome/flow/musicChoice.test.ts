import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { musicChoiceView, offersMusicChoice } from './musicChoice.ts'

describe('welcome music choice', () => {
  it('words the state as text, both ways', () => {
    assert.equal(musicChoiceView({ on: true, track: null }).stateLabel, 'Activada')
    assert.equal(musicChoiceView({ on: false, track: null }).stateLabel, 'Desactivada')
  })

  it('with a track it names it; without one there is no title', () => {
    assert.equal(musicChoiceView({ on: true, track: { title: 'Brisa' } }).title, 'Brisa')
    assert.equal(musicChoiceView({ on: true, track: null }).title, null)
  })

  it('always says it can be changed later in the audio control', () => {
    assert.match(musicChoiceView({ on: false, track: null }).hint, /control de audio/)
  })

  it('is offered only with a track and only on the first step', () => {
    assert.equal(offersMusicChoice({ hasMusic: true, stepIndex: 0 }), true)
    assert.equal(offersMusicChoice({ hasMusic: false, stepIndex: 0 }), false)
    assert.equal(offersMusicChoice({ hasMusic: true, stepIndex: 1 }), false)
  })
})
