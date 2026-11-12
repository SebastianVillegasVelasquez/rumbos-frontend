import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ApiError } from '../../course-map/data/apiError.ts'
import { documentErrorKey } from './documentErrors.ts'

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
