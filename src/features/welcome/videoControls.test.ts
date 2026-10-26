import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { es } from '../../i18n/es.ts'
import { videoPlaceholder } from '../content/videoPlaceholder.ts'
import { curtainButtons, videoHostNote } from './videoControls.ts'

const PROVIDER_WORDS = /vimeo|youtube|se cargará/i

describe('video controls carry no provider wording', () => {
  it('names no provider on any curtain button, in any state', () => {
    for (const showPlay of [true, false])
      for (const offerOptionalVideo of [true, false])
        for (const hasMusic of [true, false])
          for (const canFullscreen of [true, false])
            for (const button of curtainButtons({
              showPlay,
              offerOptionalVideo,
              hasMusic,
              canFullscreen,
            }))
              assert.doesNotMatch(button.label, PROVIDER_WORDS, button.id)
  })

  it('labels the curtain buttons as agreed', () => {
    const all = curtainButtons({
      showPlay: true,
      offerOptionalVideo: true,
      hasMusic: true,
      canFullscreen: true,
    })
    const label = (id: string) => all.find((button) => button.id === id)?.label
    assert.equal(label('primary'), 'Reproducir')
    assert.equal(label('watch'), 'Ver video de bienvenida')
    assert.equal(label('fullscreen'), 'Pantalla completa')
  })

  it('labels the click-to-load placeholder of a video block without a provider', () => {
    for (const provider of ['youtube', 'vimeo'] as const) {
      const placeholder = videoPlaceholder({ type: 'video', provider, videoId: 'x', title: 'Tema' })
      assert.equal(placeholder.buttonLabel, 'Reproducir video')
      assert.doesNotMatch(placeholder.buttonLabel, PROVIDER_WORDS)
    }
  })

  it('keeps the provider in the plain-text footnote only', () => {
    assert.equal(videoHostNote('vimeo'), 'Video alojado en Vimeo')
    assert.equal(videoHostNote('youtube'), 'Video alojado en YouTube')
    assert.equal(
      videoPlaceholder({ type: 'video', provider: 'vimeo', videoId: 'x', title: 'T' }).note,
      es.welcome.videoHost('Vimeo')
    )
  })

  it('hides the footnote when its key is empty', () => {
    assert.equal(
      videoHostNote('vimeo', () => ''),
      ''
    )
    assert.equal(
      videoHostNote('youtube', () => '   '),
      ''
    )
  })
})
