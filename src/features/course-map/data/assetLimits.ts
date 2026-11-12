import type { AssetUsage, ImageAssetKind } from './types.ts'

// Upload limits from the API contract. The client checks them first so people
// get an instant, specific message instead of waiting for a 413/422.
export const ASSET_LIMITS: Record<ImageAssetKind, { maxBytes: number; maxSide: number }> = {
  background: { maxBytes: 8 * 1024 * 1024, maxSide: 8192 },
  bubble: { maxBytes: 2 * 1024 * 1024, maxSide: 1024 },
  // Pictures inside content bubbles.
  image: { maxBytes: 4 * 1024 * 1024, maxSide: 2048 },
}

// Welcome documents: PDF only, 10 MB. The backend inspects the file (encrypted,
// active content, page count); the client only catches the obvious.
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024
export const DOCUMENT_MIME = 'application/pdf'

export type DocumentCheckError = 'notPdf' | 'tooLarge'

export const checkDocumentBasics = (file: {
  type: string
  size: number
  name?: string
}): DocumentCheckError | null => {
  const looksPdf = file.type === DOCUMENT_MIME || (!file.type && /\.pdf$/i.test(file.name ?? ''))
  if (!looksPdf) return 'notPdf'
  return file.size > DOCUMENT_MAX_BYTES ? 'tooLarge' : null
}

export const ALLOWED_IMAGE_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/avif'] as const
export const TITLE_MAX_LENGTH = 120
export const CREDIT_MAX_LENGTH = 300

export type UploadCheckError = 'notImage' | 'tooLarge' | 'tooBig'

// Pictures inside content bubbles stay to the three formats every browser
// draws.
export const allowedMimeFor = (kind: ImageAssetKind): readonly string[] =>
  kind === 'image' ? ALLOWED_IMAGE_MIME.filter((mime) => mime !== 'image/avif') : ALLOWED_IMAGE_MIME

export const checkFileBasics = (
  file: { type: string; size: number },
  kind: ImageAssetKind
): UploadCheckError | null => {
  if (!allowedMimeFor(kind).includes(file.type)) return 'notImage'
  if (file.size > ASSET_LIMITS[kind].maxBytes) return 'tooLarge'
  return null
}

export const checkDimensions = (
  width: number,
  height: number,
  kind: ImageAssetKind
): UploadCheckError | null =>
  width > ASSET_LIMITS[kind].maxSide || height > ASSET_LIMITS[kind].maxSide ? 'tooBig' : null

export const isAssetInUse = (usage: AssetUsage) => usage.maps + usage.skins + usage.publications > 0

// Width/height ratios differ "enough" to warrant a warning above this relative
// difference (5%), measured against the current ratio.
export const ASPECT_WARNING_THRESHOLD = 0.05

export const aspectRatiosDiffer = (current: number, next: number) =>
  current > 0 && Math.abs(current - next) / current > ASPECT_WARNING_THRESHOLD
