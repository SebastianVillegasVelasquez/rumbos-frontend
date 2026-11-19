import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { clipRequestUrl } from './clipSource.ts'

const url = '/api/v1/trainer/audio/a2fa-89955aab8f?v=3'

describe('where a clip is requested from', () => {
  it('keeps a host-relative url when the API is on the same origin', () => {
    assert.equal(clipRequestUrl(url, '/api/v1'), url)
  })

  it('sends it to the API origin when the API is on another one', () => {
    assert.equal(
      clipRequestUrl(url, 'https://api.example.org/api/v1'),
      'https://api.example.org/api/v1/trainer/audio/a2fa-89955aab8f?v=3'
    )
  })

  it('leaves a full address alone', () => {
    assert.equal(
      clipRequestUrl('https://cdn.example.org/a.mp3', '/api/v1'),
      'https://cdn.example.org/a.mp3'
    )
  })
})
