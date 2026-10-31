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
