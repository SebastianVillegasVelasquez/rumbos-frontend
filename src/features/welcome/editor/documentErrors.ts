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
  if (detail.code === 'document_invalid')
    return typeof detail.reason === 'string' && REASONS.has(detail.reason)
      ? (detail.reason as DocumentErrorKey)
      : 'document_invalid'
  return 'generic'
}
