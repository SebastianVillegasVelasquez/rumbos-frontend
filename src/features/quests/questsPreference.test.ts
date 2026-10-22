import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readQuestsOpen, rememberQuestsOpen } from './questsPreference.ts'

const memory = () => {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  }
}

const broken = {
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('blocked')
  },
}

describe('questsPreference', () => {
  it('starts closed and remembers the last state', () => {
    const storage = memory()
    assert.equal(readQuestsOpen(storage), false)
    rememberQuestsOpen(true, storage)
    assert.equal(readQuestsOpen(storage), true)
    rememberQuestsOpen(false, storage)
    assert.equal(readQuestsOpen(storage), false)
  })

  it('survives storage that throws', () => {
    assert.equal(readQuestsOpen(broken), false)
    assert.doesNotThrow(() => rememberQuestsOpen(true, broken))
  })
})
