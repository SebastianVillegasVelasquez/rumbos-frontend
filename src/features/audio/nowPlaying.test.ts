import assert from 'node:assert/strict'
import { test } from 'node:test'
import { coverToLoad, discState, trackDescription } from './nowPlaying.ts'

test('disc state matrix: playing, paused (overlay, hidden tab), muted', () => {
  assert.deepEqual(discState({ playing: true, wants: true }), {
    spinning: true,
    muted: false,
    badge: 'playing',
  })
  // Wanted but held (an activity overlay, a hidden tab, the welcome video).
  assert.deepEqual(discState({ playing: false, wants: true }), {
    spinning: false,
    muted: false,
    badge: 'paused',
  })
  assert.deepEqual(discState({ playing: false, wants: false }), {
    spinning: false,
    muted: true,
    badge: 'muted',
  })
})

test('muted never spins, even if the session still says playing', () => {
  assert.equal(discState({ playing: true, wants: false }).spinning, false)
})

test('the cover waits for the music, and data saver never loads it', () => {
  const base = { coverUrl: '/c.webp', dataSaver: false, startedOnce: true, failed: false }
  assert.equal(coverToLoad(base), '/c.webp')
  assert.equal(coverToLoad({ ...base, startedOnce: false }), null)
  assert.equal(coverToLoad({ ...base, dataSaver: true }), null)
  assert.equal(coverToLoad({ ...base, failed: true }), null)
  assert.equal(coverToLoad({ ...base, coverUrl: null }), null)
})

test('the description joins credit and license, skipping what is missing', () => {
  assert.equal(trackDescription({ title: 'T', credit: 'Ana', license: 'CC BY' }), 'Ana · CC BY')
  assert.equal(trackDescription({ title: 'T', credit: 'Ana', license: null }), 'Ana')
  assert.equal(trackDescription({ title: 'T', credit: '', license: '  ' }), '')
})
