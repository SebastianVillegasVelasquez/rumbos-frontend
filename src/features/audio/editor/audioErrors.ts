import type { AssetListParams } from '../../course-map/data/types.ts'

// Why an audio upload or a checked field failed, in Spanish. The codes are the
// contract's: 422 audio_rights_declaration_required, audio_credit_required,
// audio_invalid, audio_too_long; 413 asset_too_large (audio is at most 8 MB);
// 503 audio_uploads_disabled.

export const AUDIO_MAX_BYTES = 8 * 1024 * 1024
export const AUDIO_MIME_TYPES = ['audio/mpeg', 'audio/mp4'] as const

export type AudioErrorKey =
  | 'audio_rights_declaration_required'
  | 'audio_credit_required'
  | 'audio_invalid'
  | 'audio_too_long'
  | 'asset_too_large'
  | 'audio_uploads_disabled'
  | 'unreachable'
  | 'unknown'

const CODES: readonly string[] = [
  'audio_rights_declaration_required',
  'audio_credit_required',
  'audio_invalid',
  'audio_too_long',
  'asset_too_large',
  'audio_uploads_disabled',
]

// What the failure is, from the HTTP status and the error code in the body.
export const classifyAudioError = (failure: {
  status: number
  code: string | undefined
}): AudioErrorKey => {
  if (failure.status === 0) return 'unreachable'
  if (failure.code && CODES.includes(failure.code)) return failure.code as AudioErrorKey
  // Statuses the contract names, for a backend that omits the code.
  if (failure.status === 413) return 'asset_too_large'
  if (failure.status === 503) return 'audio_uploads_disabled'
  return 'unknown'
}

// Problems the client can see before sending anything.
export type AudioFieldProblem =
  'noFile' | 'notAudio' | 'tooLarge' | 'noTitle' | 'noCredit' | 'noDeclaration'

export const checkAudioForm = (input: {
  file: { type: string; size: number } | null
  title: string
  credit: string
  declared: boolean
}): AudioFieldProblem | null => {
  if (!input.file) return 'noFile'
  if (!(AUDIO_MIME_TYPES as readonly string[]).includes(input.file.type)) return 'notAudio'
  if (input.file.size > AUDIO_MAX_BYTES) return 'tooLarge'
  if (!input.title.trim()) return 'noTitle'
  if (!input.credit.trim()) return 'noCredit'
  if (!input.declared) return 'noDeclaration'
  return null
}

// m:ss for the track list.
export const formatDuration = (seconds: number | null | undefined): string => {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return ''
  const whole = Math.round(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

// The same query the studio uses to decide whether to show this tab at all.
export const AUDIO_LIBRARY_PARAMS: AssetListParams = {
  kind: 'audio',
  scope: 'library',
  limit: 100,
}
