import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { tokenDiff, words } from './tokenDiff.ts'

describe('token diff', () => {
  it('splits words and keeps punctuation apart', () => {
    assert.deepEqual(words("Hello, it's a check-in!"), ['Hello', ',', "it's", 'a', 'check-in', '!'])
  })

  it('identical text, ignoring case, is all the same', () => {
    assert.deepEqual(tokenDiff('i am here', 'I am here'), [{ kind: 'same', text: 'I am here' }])
  })

  it('marks a missing word as added and an extra one as removed', () => {
    const parts = tokenDiff('I am student', 'I am a student')
    assert.deepEqual(parts, [
      { kind: 'same', text: 'I am' },
      { kind: 'added', text: 'a' },
      { kind: 'same', text: 'student' },
    ])
    const extra = tokenDiff('I am very a student', 'I am a student')
    assert.ok(extra.some((p) => p.kind === 'removed' && p.text === 'very'))
  })

  it('a replaced word is one removed and one added', () => {
    const parts = tokenDiff('She go home', 'She goes home')
    assert.deepEqual(
      parts.map((p) => p.kind),
      ['same', 'removed', 'added', 'same']
    )
  })

  it('empty input gives everything as added or removed', () => {
    assert.deepEqual(tokenDiff('', 'Hi there'), [{ kind: 'added', text: 'Hi there' }])
    assert.deepEqual(tokenDiff('Hi there', ''), [{ kind: 'removed', text: 'Hi there' }])
    assert.deepEqual(tokenDiff('', ''), [])
  })
})
