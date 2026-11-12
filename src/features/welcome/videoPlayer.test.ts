import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isEndedMessage,
  nextVideoLoad,
  playbackOf,
  playerUrl,
  signalOf,
  subscribeMessages,
  type VideoLoad,
} from './videoPlayer.ts'

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

  it('asks Vimeo to report play and pause too', () => {
    const messages = subscribeMessages('vimeo').join(' ')
    assert.ok(messages.includes('play') && messages.includes('pause'))
  })
})

describe('playbackOf', () => {
  const cases: Array<[string, 'youtube' | 'vimeo', unknown, string | null]> = [
    ['YouTube playing', 'youtube', '{"event":"onStateChange","info":1}', 'playing'],
    ['YouTube paused', 'youtube', { event: 'onStateChange', info: 2 }, 'paused'],
    ['YouTube ended', 'youtube', '{"event":"infoDelivery","info":{"playerState":0}}', 'ended'],
    ['YouTube buffering says nothing', 'youtube', { event: 'onStateChange', info: 3 }, null],
    ['Vimeo play', 'vimeo', '{"event":"play"}', 'playing'],
    ['Vimeo pause', 'vimeo', { event: 'pause' }, 'paused'],
    ['Vimeo finish', 'vimeo', { event: 'finish' }, 'ended'],
    ['junk', 'youtube', '{bad', null],
    ['null', 'vimeo', null, null],
  ]
  for (const [name, provider, data, expected] of cases)
    it(name, () => assert.equal(playbackOf(provider, data), expected))
})

describe('nextVideoLoad', () => {
  const cases: Array<[VideoLoad, 'load' | 'timeout', VideoLoad]> = [
    ['loading', 'load', 'loaded'],
    ['loading', 'timeout', 'failed'],
    ['loaded', 'timeout', 'loaded'],
    ['failed', 'load', 'loaded'],
    ['failed', 'timeout', 'failed'],
  ]
  for (const [from, event, to] of cases)
    it(from + ' + ' + event + ' = ' + to, () => assert.equal(nextVideoLoad(from, event), to))
})

describe('signalOf', () => {
  const cases: Array<[string, 'youtube' | 'vimeo', unknown, string | null]> = [
    ['YouTube ready', 'youtube', '{"event":"onReady"}', 'ready'],
    ['YouTube error', 'youtube', { event: 'onError', info: 150 }, 'error'],
    ['YouTube playing', 'youtube', '{"event":"onStateChange","info":1}', 'playing'],
    ['YouTube ended', 'youtube', '{"event":"infoDelivery","info":{"playerState":0}}', 'ended'],
    ['YouTube unrelated', 'youtube', '{"event":"initialDelivery","info":{}}', null],
    ['Vimeo ready', 'vimeo', '{"event":"ready","player_id":"x"}', 'ready'],
    ['Vimeo play', 'vimeo', { event: 'play' }, 'playing'],
    ['Vimeo finish', 'vimeo', { event: 'finish' }, 'ended'],
    ['Vimeo error', 'vimeo', '{"event":"error","data":{"message":"x"}}', 'error'],
    ['a YouTube event on Vimeo is nothing', 'vimeo', '{"event":"onReady"}', null],
    ['a Vimeo event on YouTube is nothing', 'youtube', '{"event":"ready"}', null],
    ['not JSON', 'youtube', 'hello', null],
    ['a number', 'vimeo', 7, null],
  ]
  for (const [name, provider, data, expected] of cases)
    it(name, () => assert.equal(signalOf(provider, data), expected))

  it('asks Vimeo to report errors too', () => {
    assert.ok(subscribeMessages('vimeo').join(' ').includes('error'))
  })
})
