import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { esTrainer } from '../../i18n/trainer.es.ts'
import { publicationLabel, studentsCanSee } from './publication.ts'

const copy = esTrainer.publication

describe('publication state for editors', () => {
  it('says each known state in words', () => {
    assert.equal(publicationLabel('published', copy), 'Publicado')
    assert.match(publicationLabel('draft', copy) ?? '', /Borrador.*estudiantes no lo verán/)
    assert.match(publicationLabel('unpublished', copy) ?? '', /Sin publicar/)
    assert.match(publicationLabel('archived', copy) ?? '', /Archivado/)
  })

  it('shows an unknown state as it came, and nothing when the field is absent', () => {
    assert.equal(publicationLabel('in_review', copy), 'Estado: in_review')
    assert.equal(publicationLabel(undefined, copy), null)
  })

  it('only published is visible to students', () => {
    assert.equal(studentsCanSee('published'), true)
    assert.equal(studentsCanSee('draft'), false)
    assert.equal(studentsCanSee(undefined), null)
  })
})
