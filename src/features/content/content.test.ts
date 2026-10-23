import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Content } from './contentTypes.ts'
import { validateContent } from './validateContent.ts'
import { parseVideoInput, videoEmbedUrl } from './video.ts'

const blocks = (list: unknown[], title = 'Bienvenida'): Content =>
  ({
    type: 'blocks',
    title,
    autoOpen: 'never',
    body: { schemaVersion: 1, blocks: list },
  }) as Content

const paths = (content: Content) => validateContent(content).map((p) => `${p.path}:${p.code}`)

describe('validateContent', () => {
  it('accepts a well-formed body', () => {
    assert.deepEqual(
      paths(
        blocks([
          { type: 'heading', text: 'Hola', level: 2 },
          { type: 'paragraph', text: 'Línea 1\nLínea 2' },
          { type: 'link', text: 'Guía', url: 'https://example.org/guia' },
          { type: 'video', provider: 'youtube', videoId: 'dQw4w9WgXcQ', title: 'Video' },
          { type: 'divider' },
        ])
      ),
      []
    )
  })

  it('requires a title and caps blocks', () => {
    assert.deepEqual(paths(blocks([], '  ')), ['title:required'])
    const many = Array.from({ length: 41 }, () => ({ type: 'divider' }))
    assert.ok(paths(blocks(many)).includes('blocks:too_many'))
  })

  it('refuses links that are not https, carry credentials or run script', () => {
    for (const url of [
      'http://a.org',
      'javascript:alert(1)',
      'https://u:p@a.org',
      'a.org',
      'data:text/html,x',
    ])
      assert.deepEqual(paths(blocks([{ type: 'link', text: 'x', url }])), [
        'blocks.0.url:not_https',
      ])
  })

  it('needs alt text on images and a real asset id', () => {
    const id = '11111111-1111-4111-8111-111111111111'
    assert.deepEqual(paths(blocks([{ type: 'image', assetId: id, alt: '' }])), [
      'blocks.0.alt:required',
    ])
    assert.deepEqual(paths(blocks([{ type: 'image', assetId: 'x', alt: 'a' }])), [
      'blocks.0.assetId:required',
    ])
  })

  it('checks the widget text alternative and size', () => {
    const widget = (html: string, altText = 'Un juego'): Content => ({
      type: 'widget',
      title: 'Juego',
      autoOpen: 'never',
      altText,
      html,
    })
    assert.deepEqual(paths(widget('<p>x</p>')), [])
    assert.deepEqual(paths(widget('<p>x</p>', '')), ['altText:required'])
    assert.deepEqual(paths(widget('x'.repeat(200 * 1024 + 1))), ['html:too_large'])
  })
})

describe('parseVideoInput', () => {
  it('extracts ids from the usual YouTube and Vimeo addresses', () => {
    const youtube = { provider: 'youtube', videoId: 'dQw4w9WgXcQ' }
    for (const input of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3s',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      'dQw4w9WgXcQ',
    ])
      assert.deepEqual(parseVideoInput(input), youtube)
    const vimeo = { provider: 'vimeo', videoId: '76979871' }
    for (const input of [
      'https://vimeo.com/76979871',
      'https://player.vimeo.com/video/76979871',
      '76979871',
    ])
      assert.deepEqual(parseVideoInput(input), vimeo)
  })

  it('refuses everything else', () => {
    for (const input of [
      '',
      'http://youtu.be/dQw4w9WgXcQ',
      'https://evil.example/watch?v=dQw4w9WgXcQ',
      'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=short',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ"><script>',
      'javascript:alert(1)',
    ])
      assert.equal(parseVideoInput(input), null, input)
  })
})

describe('videoEmbedUrl', () => {
  it('only ever points at the two privacy-friendly players', () => {
    assert.equal(
      videoEmbedUrl('youtube', 'dQw4w9WgXcQ'),
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0'
    )
    assert.equal(
      videoEmbedUrl('vimeo', '76979871'),
      'https://player.vimeo.com/video/76979871?dnt=1'
    )
    assert.equal(videoEmbedUrl('youtube', 'x" onload="'), null)
  })
})
