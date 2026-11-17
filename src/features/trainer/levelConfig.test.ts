import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { SCAFFOLDING, scaffoldingFor } from './levelConfig.ts'

describe('level scaffolding', () => {
  it('has an entry for every level and gives less help as the level rises', () => {
    const count = (level: keyof typeof SCAFFOLDING) =>
      Object.values(SCAFFOLDING[level]).filter(Boolean).length
    assert.ok(count('A1') > count('A2'))
    assert.ok(count('A2') > count('B1'))
    assert.ok(count('B1') > count('B2'))
  })

  it('A1 shows every aid, B2 none of the language aids', () => {
    assert.deepEqual(scaffoldingFor('A1'), {
      translation: true,
      starters: true,
      wordBank: true,
      hints: true,
      slowAudio: true,
    })
    const b2 = scaffoldingFor('B2')
    assert.equal(b2.translation || b2.starters || b2.wordBank, false)
  })

  it('an unknown or missing level falls back to A1', () => {
    assert.deepEqual(scaffoldingFor(undefined), SCAFFOLDING.A1)
  })
})
