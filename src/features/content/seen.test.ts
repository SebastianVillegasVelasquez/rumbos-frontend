import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Content } from './contentTypes.ts'
import { contentHash, isContentSeen, markContentSeen, shouldAutoOpen } from './seen.ts'

const memory = () => {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  }
}

const content = (title: string, autoOpen: Content['autoOpen'] = 'first_visit'): Content => ({
  type: 'blocks',
  title,
  autoOpen,
  body: { schemaVersion: 1, blocks: [] },
})

describe('content seen state', () => {
  it('opens a first-visit content once, then never again', () => {
    const storage = memory()
    const intro = content('Introducción')
    assert.equal(shouldAutoOpen(storage, 'b1', intro), true)
    markContentSeen(storage, 'b1', intro)
    assert.equal(isContentSeen(storage, 'b1', intro), true)
    assert.equal(shouldAutoOpen(storage, 'b1', intro), false)
  })

  it('treats edited content as new', () => {
    const storage = memory()
    markContentSeen(storage, 'b1', content('Introducción'))
    assert.equal(shouldAutoOpen(storage, 'b1', content('Introducción v2')), true)
    assert.notEqual(contentHash(content('a')), contentHash(content('b')))
  })

  it('never auto-opens content that asks not to', () => {
    assert.equal(shouldAutoOpen(memory(), 'b1', content('x', 'never')), false)
  })

  it('works when storage is missing, blocked or holds garbage', () => {
    assert.equal(isContentSeen(null, 'b1', content('x')), false)
    markContentSeen(null, 'b1', content('x'))
    const throwing = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    assert.equal(shouldAutoOpen(throwing, 'b1', content('x')), true)
    markContentSeen(throwing, 'b1', content('x'))
    for (const raw of ['not json', '[]', '"x"', '{"b1":5}'])
      assert.equal(isContentSeen({ getItem: () => raw }, 'b1', content('x')), false)
  })
})
