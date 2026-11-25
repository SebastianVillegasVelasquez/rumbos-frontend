import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { stageOf } from './closingJourney.ts'
import { initialSim, simAttempt, simStatus } from './journeySimulation.ts'

const stage = (s: ReturnType<typeof initialSim>) => stageOf(simStatus(s))

describe('the journey simulation', () => {
  it('scenario A passes the check-in and skips the final', () => {
    assert.equal(stage(initialSim('A')), 'passed_checkin')
    assert.equal(simStatus(initialSim('A')).outcome?.final.attempts, null)
  })
  it('scenario B is locked until the content is done, then asks the final', () => {
    const s = initialSim('B')
    assert.equal(stage(s), 'final_locked')
    assert.equal(stage({ ...s, contentDone: true }), 'final_ready')
  })
  it('a pass on any attempt ends in the final congratulations', () => {
    let s = { ...initialSim('B'), contentDone: true }
    s = simAttempt(s, false)
    s = simAttempt(s, true)
    assert.equal(stage(s), 'final_passed')
    assert.equal(simAttempt(s, false), s)
  })
  it('three failures exhaust the attempts', () => {
    let s = { ...initialSim('B'), contentDone: true }
    for (let i = 0; i < 5; i++) s = simAttempt(s, false)
    assert.equal(s.attempts.length, 3)
    assert.equal(stage(s), 'exhausted')
  })
  it('refuses attempts before the content is done', () => {
    const s = initialSim('B')
    assert.equal(simAttempt(s, true), s)
  })
})
