import { ApiError } from '../course-map/data/apiError.ts'
import { es } from '../../i18n/es.ts'
import { isMissingRoute } from './transferSupport.ts'

// One place that turns what the backend said into what the editor reads.

export interface TransferFailure {
  // Spanish, ready to show.
  message: string
  // The routes are not there: the entry points should disappear.
  unsupported?: boolean
}

const detailOf = (error: unknown) => (error instanceof ApiError ? error.detail : null)

const common = (error: unknown): TransferFailure | null => {
  if (isMissingRoute(error)) return { message: es.transfer.errors.unsupported, unsupported: true }
  if (error instanceof ApiError && error.status === 0)
    return { message: es.transfer.errors.unreachable }
  if (error instanceof ApiError && (error.status === 401 || error.status === 403))
    return { message: es.transfer.errors.forbidden }
  return null
}

export interface ImportFailure extends TransferFailure {
  // The staged import is gone: start again from the upload.
  expired?: boolean
  // The backend refused this activity because it already sits on another level.
  placedCmid?: number
  // Extra lines, such as the problems found inside the archive.
  details?: string[]
}

const MAX_DETAILS = 5

const problemsOf = (error: unknown): string[] => {
  const problems = error instanceof ApiError ? error.detail.problems : null
  if (!Array.isArray(problems)) return []
  return problems
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.slice(0, 200))
    .slice(0, MAX_DETAILS)
}

export const describeImportError = (error: unknown): ImportFailure => {
  const known = common(error)
  if (known) return known
  const status = error instanceof ApiError ? error.status : 0
  const code = detailOf(error)?.code
  const e = es.transfer.errors
  if (status === 413) return { message: e.archiveTooLarge }
  if (status === 422 && code === 'archive_version_unsupported') return { message: e.archiveVersion }
  if (status === 422 && code === 'archive_invalid')
    return { message: e.archiveInvalid, details: problemsOf(error) }
  if (status === 422 && code === 'audio_rights_declaration_required')
    return { message: e.audioRights }
  if (status === 422) return { message: e.mappingInvalid }
  if (status === 429) return { message: e.rateLimited }
  if (status === 410 || (status === 404 && code === 'import_not_found'))
    return { message: e.importExpired, expired: true }
  if (status === 409 && code === 'import_already_applied') return { message: e.alreadyApplied }
  if (status === 409 && code === 'activity_already_placed') {
    const cmid = detailOf(error)?.cmid
    return {
      message: e.activityPlaced,
      ...(typeof cmid === 'number' && { placedCmid: cmid }),
    }
  }
  if (status === 507) return { message: e.quota }
  return { message: e.generic }
}

export const describeExportError = (error: unknown): TransferFailure => {
  const known = common(error)
  if (known) return known
  const status = error instanceof ApiError ? error.status : 0
  const code = detailOf(error)?.code
  const e = es.transfer.errors
  if (status === 404) return { message: e.exportNotFound }
  if (status === 409 && code === 'never_saved') return { message: e.exportNeverSaved }
  if (status === 413) return { message: e.exportTooLarge }
  if (status === 422) return { message: e.exportInvalid }
  return { message: e.generic }
}
