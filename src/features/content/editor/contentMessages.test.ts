import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Content } from '../contentTypes.ts'
import { validateContent } from '../validateContent.ts'
import { contentErrorMessage, describeProblems } from './contentMessages.ts'

const say = (content: Content) => describeProblems(content, validateContent(content))

describe('describeProblems', () => {
  it('names the block and what is missing, once', () => {
    const content: Content = {
      type: 'blocks',
      title: '',
      autoOpen: 'never',
      body: {
        schemaVersion: 1,
        blocks: [
          { type: 'paragraph', text: '' },
          { type: 'image', assetId: '', alt: '' },
          { type: 'video', provider: 'youtube', videoId: '', title: '' },
          { type: 'link', text: 'x', url: 'http://a.org' },
        ],
      },
    }
    assert.deepEqual(say(content), [
      'Escribe un título.',
      'Bloque 1: escribe el texto.',
      'Bloque 2: elige una imagen.',
      'Bloque 2: escribe el texto alternativo.',
      'Bloque 3: el enlace o código del video no es válido.',
      'Bloque 3: escribe el título del video.',
      'Bloque 4: la dirección debe empezar con https://',
    ])
  })

  it('asks for the widget description', () => {
    assert.deepEqual(
      say({ type: 'widget', title: 'Juego', autoOpen: 'never', altText: '', html: '<p>x</p>' }),
      ['Escribe la descripción para lectores de pantalla.']
    )
  })
})

describe('contentErrorMessage', () => {
  it('maps the backend answers to Spanish', () => {
    const error = (status: number, code?: string) => ({ status, detail: { code } })
    assert.match(contentErrorMessage(error(403, 'widgets_disabled')), /widgets/)
    assert.match(contentErrorMessage(error(413, 'content_too_large')), /demasiado grande/)
    assert.match(contentErrorMessage(error(422, 'content_invalid')), /no aceptó/)
    assert.match(contentErrorMessage(error(422, 'validation_error')), /no admite/)
    assert.match(contentErrorMessage(new Error('x')), /No pudimos guardar/)
  })
})
