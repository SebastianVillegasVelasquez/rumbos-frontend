import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mockCoverDataUri } from './mockCover.ts'

test('the mock cover is a self-contained SVG data URI', () => {
  const uri = mockCoverDataUri('a')
  assert.ok(uri.startsWith('data:image/svg+xml'))
  assert.ok(decodeURIComponent(uri).includes('viewBox="0 0 512 512"'))
})

test('different seeds give different art, the same seed the same art', () => {
  assert.notEqual(mockCoverDataUri('a'), mockCoverDataUri('b'))
  assert.equal(mockCoverDataUri('a'), mockCoverDataUri('a'))
})
