import { es } from '../../i18n/es.ts'
import { describeHttpFailure } from './errorReason.ts'
import { classifyFeatureError } from './escalation.ts'

// The message for a feature that failed, in plain Spanish. The technical code
// (and HTTP status) is appended only in development.
export const friendlyApiMessage = (status: number, code: unknown, dev: boolean): string => {
  const text = es.localErrors
  const base =
    classifyFeatureError(status, code) === 'moodle_source_not_provided'
      ? text.notAvailableInMode
      : status === 0
        ? text.unreachable
        : status === 401 || status === 403
          ? text.forbidden
          : status === 404
            ? text.notFound
            : status === 409 || status === 412
              ? text.conflict
              : status === 429
                ? text.tooMany
                : status >= 500
                  ? text.server
                  : text.generic
  return dev ? `${base} (${describeHttpFailure(status, code)})` : base
}
