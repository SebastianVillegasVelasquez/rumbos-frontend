import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { COACH_STEPS, readCoachDone, rememberCoachDone } from './coachPreference.ts'

const memory = () => {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  }
}

describe('coach marks preference', () => {
  it('shows until done, then never again', () => {
    const storage = memory()
    assert.equal(readCoachDone(storage), false)
    rememberCoachDone(storage)
    assert.equal(readCoachDone(storage), true)
  })

  it('with unreadable storage, does not nag (treated as done)', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
    }
    assert.equal(readCoachDone(broken), true)
    assert.equal(readCoachDone(null), false)
  })

  it('has the three steps of the brief, in order', () => {
    assert.deepEqual([...COACH_STEPS], ['move', 'bubble', 'quests'])
  })
})
