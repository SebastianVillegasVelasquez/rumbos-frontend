// A rough PDF check for the MOCK backend only. The real backend does the real
// inspection (its 422 document_invalid reasons); this mirrors the reasons so the
// editor's messages can be exercised without a server. It reads bytes as latin1
// text and looks for markers, so it is neither complete nor a security control.

export type DocumentInvalidReason =
  'not_pdf' | 'encrypted' | 'active_content' | 'too_many_pages' | 'corrupt'

// ASSUMPTION: the brief names the reason `too_many_pages` without a number.
export const DOCUMENT_MAX_PAGES = 200

export type PdfInspection =
  { ok: true; pageCount: number } | { ok: false; reason: DocumentInvalidReason }

const latin1 = (bytes: Uint8Array): string => {
  let text = ''
  const step = 8192
  for (let i = 0; i < bytes.length; i += step)
    text += String.fromCharCode(...bytes.subarray(i, i + step))
  return text
}

export const inspectPdf = (bytes: Uint8Array): PdfInspection => {
  if (bytes.length < 8 || latin1(bytes.subarray(0, 5)) !== '%PDF-')
    return { ok: false, reason: 'not_pdf' }
  const text = latin1(bytes)
  if (!text.includes('%%EOF')) return { ok: false, reason: 'corrupt' }
  if (/\/Encrypt\b/.test(text)) return { ok: false, reason: 'encrypted' }
  if (/\/(JavaScript|JS|Launch|EmbeddedFile|OpenAction)\b/.test(text))
    return { ok: false, reason: 'active_content' }
  // Page objects are "/Type /Page" and not "/Type /Pages".
  const pageCount = (text.match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length
  if (pageCount === 0) return { ok: false, reason: 'corrupt' }
  if (pageCount > DOCUMENT_MAX_PAGES) return { ok: false, reason: 'too_many_pages' }
  return { ok: true, pageCount }
}
