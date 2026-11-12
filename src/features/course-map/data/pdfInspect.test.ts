import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DOCUMENT_MAX_PAGES, inspectPdf } from './pdfInspect.ts'

const bytes = (text: string) => new TextEncoder().encode(text)
const pdf = (body: string, pages = 1) =>
  bytes(
    `%PDF-1.4\n1 0 obj<</Type/Pages>>endobj\n${Array.from({ length: pages }, () => '2 0 obj<</Type /Page>>endobj\n').join('')}${body}\n%%EOF`
  )

describe('the mock PDF inspection mirrors the contract reasons', () => {
  it('accepts a plain document and counts its pages, not the page tree', () => {
    assert.deepEqual(inspectPdf(pdf('', 3)), { ok: true, pageCount: 3 })
  })
  it('not_pdf: another file type, or too short', () => {
    assert.deepEqual(inspectPdf(bytes('GIF89a....')), { ok: false, reason: 'not_pdf' })
    assert.deepEqual(inspectPdf(bytes('%PDF')), { ok: false, reason: 'not_pdf' })
  })
  it('corrupt: no end marker or no pages', () => {
    assert.deepEqual(inspectPdf(bytes('%PDF-1.4\n2 0 obj<</Type/Page>>')), {
      ok: false,
      reason: 'corrupt',
    })
    assert.deepEqual(inspectPdf(bytes('%PDF-1.4\n%%EOF')), { ok: false, reason: 'corrupt' })
  })
  it('encrypted and active content are refused', () => {
    assert.deepEqual(inspectPdf(pdf('trailer<</Encrypt 9 0 R>>')), {
      ok: false,
      reason: 'encrypted',
    })
    assert.deepEqual(inspectPdf(pdf('<</S/JavaScript/JS(app.alert(1))>>')), {
      ok: false,
      reason: 'active_content',
    })
    assert.deepEqual(inspectPdf(pdf('<</OpenAction 5 0 R>>')), {
      ok: false,
      reason: 'active_content',
    })
  })
  it('too_many_pages past the limit', () => {
    assert.equal(inspectPdf(pdf('', DOCUMENT_MAX_PAGES)).ok, true)
    assert.deepEqual(inspectPdf(pdf('', DOCUMENT_MAX_PAGES + 1)), {
      ok: false,
      reason: 'too_many_pages',
    })
  })
})
