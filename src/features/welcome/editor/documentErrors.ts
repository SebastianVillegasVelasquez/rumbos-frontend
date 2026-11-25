import { ApiError } from '../../course-map/data/apiError.ts'

// Which message an author gets when a PDF upload fails. The reasons are the
// backend document_invalid reasons (the mock reuses them from pdfInspect).
export type DocumentErrorKey =
  | 'document_invalid'
  | 'not_pdf'
  | 'encrypted'
  | 'active_content'
  | 'too_many_pages'
  | 'corrupt'
  | 'asset_too_large'
  | 'rights'
  | 'title'
  | 'quarantined'
  | 'quota'
  | 'generic'

const REASONS: ReadonlySet<string> = new Set([
  'not_pdf',
  'encrypted',
  'active_content',
  'too_many_pages',
  'corrupt',
])

export const documentErrorKey = (error: unknown): DocumentErrorKey => {
  if (!(error instanceof ApiError)) return 'generic'
  const detail = error.detail as { code: string; reason?: unknown }
  if (detail.code === 'asset_too_large') return 'asset_too_large'
  if (detail.code === 'document_rights_declaration_required') return 'rights'
  if (detail.code === 'invalid_asset_metadata') return 'title'
  if (detail.code === 'document_quarantined') return 'quarantined'
  if (detail.code === 'asset_quota_exceeded') return 'quota'
  if (detail.code === 'document_invalid')
    return typeof detail.reason === 'string' && REASONS.has(detail.reason)
      ? (detail.reason as DocumentErrorKey)
      : 'document_invalid'
  return 'generic'
}

// The title a PDF upload carries: the contract requires one (1 to 200 characters) and the
// author is not asked for it, so it is the file's name without its extension.
export const DOCUMENT_TITLE_MAX = 200
export const documentTitle = (fileName: string): string => {
  const base = fileName.replace(/\.[^.]*$/, '').trim()
  return (base || 'Documento').slice(0, DOCUMENT_TITLE_MAX).trim()
}
