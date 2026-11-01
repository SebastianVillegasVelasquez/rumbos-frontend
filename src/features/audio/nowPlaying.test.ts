import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  PILL_MS,
  coverToLoad,
  discState,
  markPillSeen,
  pillLevelForRoom,
  pillLines,
  pillSeen,
  pillVisible,
  shouldAutoShowPill,
  trackDescription,
} from './nowPlaying.ts'

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

test('the pill ladder drops lines as room shrinks', () => {
  assert.equal(pillLevelForRoom(260), 3)
  assert.equal(pillLevelForRoom(200), 3)
  assert.equal(pillLevelForRoom(199), 2)
  assert.equal(pillLevelForRoom(140), 2)
  assert.equal(pillLevelForRoom(139), 1)
})

test('the pill content at each level, and with credit data missing', () => {
  const full = { title: 'Brisa', credit: 'Ana', license: 'CC BY' }
  assert.deepEqual(
    pillLines(full, 3).map((line) => line.text),
    ['Brisa', 'Ana', 'CC BY']
  )
  assert.deepEqual(
    pillLines(full, 2).map((line) => line.text),
    ['Brisa', 'Ana · CC BY']
  )
  assert.deepEqual(
    pillLines(full, 1).map((line) => line.text),
    ['Brisa']
  )
  const bare = { title: 'Brisa', credit: '', license: null }
  for (const level of [3, 2, 1] as const) {
    assert.deepEqual(
      pillLines(bare, level).map((line) => line.text),
      ['Brisa']
    )
  }
  assert.deepEqual(
    pillLines({ ...full, license: null }, 3).map((line) => line.text),
    ['Brisa', 'Ana']
  )
})

test('the pill shows by itself once, and waits for the tour', () => {
  const base = { playing: true, alreadyShown: false, tourOnControl: false }
  assert.equal(shouldAutoShowPill(base), true)
  assert.equal(shouldAutoShowPill({ ...base, playing: false }), false)
  // A resume after an overlay is not a new start.
  assert.equal(shouldAutoShowPill({ ...base, alreadyShown: true }), false)
  assert.equal(shouldAutoShowPill({ ...base, tourOnControl: true }), false)
})

test('the pill follows the timer, hover and focus, and yields to the popover and the tour', () => {
  const off = {
    timed: false,
    hovered: false,
    focused: false,
    popoverOpen: false,
    tourOnControl: false,
  }
  assert.equal(pillVisible(off), false)
  assert.equal(pillVisible({ ...off, timed: true }), true)
  assert.equal(pillVisible({ ...off, hovered: true }), true)
  assert.equal(pillVisible({ ...off, focused: true }), true)
  assert.equal(pillVisible({ ...off, timed: true, popoverOpen: true }), false)
  assert.equal(pillVisible({ ...off, hovered: true, tourOnControl: true }), false)
})

test('the pill window is about six seconds', () => {
  assert.equal(PILL_MS, 6000)
})

test('a track is marked seen once per session', () => {
  assert.equal(pillSeen('t1'), false)
  markPillSeen('t1')
  assert.equal(pillSeen('t1'), true)
})
