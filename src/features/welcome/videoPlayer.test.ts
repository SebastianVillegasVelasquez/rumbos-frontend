import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isEndedMessage, playerUrl, subscribeMessages } from './videoPlayer.ts'

describe('playerUrl', () => {
  it('builds the address from a validated id only', () => {
    assert.match(
      playerUrl('youtube', 'dQw4w9WgXcQ') ?? '',
      /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/
    )
    assert.match(
      playerUrl('vimeo', '76979871') ?? '',
      /^https:\/\/player\.vimeo\.com\/video\/76979871\?/
    )
    assert.equal(playerUrl('youtube', 'x"><script>'), null)
    assert.equal(playerUrl('vimeo', '../../evil'), null)
  })
})

describe('isEndedMessage', () => {
  it('reads YouTube state changes, as text or as an object', () => {
    assert.equal(isEndedMessage('youtube', '{"event":"onStateChange","info":0}'), true)
    assert.equal(isEndedMessage('youtube', { event: 'onStateChange', info: 1 }), false)
    assert.equal(
      isEndedMessage('youtube', '{"event":"infoDelivery","info":{"playerState":0}}'),
      true
    )
    assert.equal(
      isEndedMessage('youtube', '{"event":"infoDelivery","info":{"currentTime":3}}'),
      false
    )
  })

  it('reads the Vimeo finish event', () => {
    assert.equal(isEndedMessage('vimeo', '{"event":"finish"}'), true)
    assert.equal(isEndedMessage('vimeo', { event: 'play' }), false)
    assert.equal(isEndedMessage('vimeo', '{"event":"onStateChange","info":0}'), false)
  })

  it('ignores anything that is not a player message', () => {
    for (const data of [null, 42, 'hola', '[1]', '{bad', undefined])
      assert.equal(isEndedMessage('youtube', data), false)
  })
})

describe('subscribeMessages', () => {
  it('asks each provider to report the end', () => {
    assert.ok(subscribeMessages('youtube').some((m) => m.includes('onStateChange')))
    assert.ok(subscribeMessages('vimeo').some((m) => m.includes('finish')))
  })
})
