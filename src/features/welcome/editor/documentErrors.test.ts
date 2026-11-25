import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ApiError } from '../../course-map/data/apiError.ts'
import { DOCUMENT_TITLE_MAX, documentErrorKey, documentTitle } from './documentErrors.ts'

const failure = (status: number, code: string, extras: object = {}) =>
  new ApiError(status, { code, message: 'x', ...extras })

describe('what an author is told when a PDF upload fails', () => {
  it('names the reason the backend gives', () => {
    for (const reason of ['not_pdf', 'encrypted', 'active_content', 'too_many_pages', 'corrupt'])
      assert.equal(documentErrorKey(failure(422, 'document_invalid', { reason })), reason)
  })
  it('falls back for an unknown reason', () => {
    assert.equal(
      documentErrorKey(failure(422, 'document_invalid', { reason: 'new' })),
      'document_invalid'
    )
    assert.equal(documentErrorKey(failure(422, 'document_invalid')), 'document_invalid')
  })
  it('knows the size and the rights failures', () => {
    assert.equal(documentErrorKey(failure(413, 'asset_too_large')), 'asset_too_large')
    assert.equal(documentErrorKey(failure(422, 'document_rights_declaration_required')), 'rights')
  })
  it('says something generic for anything else, a network error included', () => {
    assert.equal(documentErrorKey(failure(500, 'boom')), 'generic')
    assert.equal(documentErrorKey(new Error('offline')), 'generic')
  })
})

describe('the title a PDF upload carries', () => {
  it('is the file name without its extension', () => {
    assert.equal(documentTitle('Guía de cierre.pdf'), 'Guía de cierre')
    assert.equal(documentTitle('a.b.c.PDF'), 'a.b.c')
  })
  it('is never blank, because the backend refuses a document without a title', () => {
    assert.equal(documentTitle('.pdf'), 'Documento')
    assert.equal(documentTitle('   .pdf'), 'Documento')
    assert.equal(documentTitle(''), 'Documento')
  })
  it('never exceeds the 200 characters the contract allows', () => {
    assert.equal(documentTitle(`${'x'.repeat(400)}.pdf`).length, DOCUMENT_TITLE_MAX)
  })
})

describe('the two other failures the backend names for a document', () => {
  it('a missing or invalid title is told as a title problem, not a generic one', () => {
    assert.equal(documentErrorKey(failure(422, 'invalid_asset_metadata')), 'title')
  })
  it('a document the operator took down is told as such', () => {
    assert.equal(documentErrorKey(failure(422, 'document_quarantined')), 'quarantined')
  })
  it('a full library is told as a quota problem', () => {
    assert.equal(documentErrorKey(failure(507, 'asset_quota_exceeded')), 'quota')
  })
})
