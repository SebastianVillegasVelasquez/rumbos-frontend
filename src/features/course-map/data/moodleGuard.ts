// The backend does not serve Moodle data in plugin (embed) mode: the three
// Moodle-backed endpoints answer 501 `moodle_source_not_provided` and the host
// provides the data instead. Reaching one from the embedded app is a programming
// error, so it is stopped here, before any request, with that same answer.

export const MOODLE_SOURCE_NOT_PROVIDED = 'moodle_source_not_provided'

export class MoodleSourceNotProvidedError extends Error {
  readonly status = 501
  readonly body = {
    code: MOODLE_SOURCE_NOT_PROVIDED,
    message: 'Moodle data comes from the host in plugin mode.',
  }
  constructor() {
    super(`Request failed with status 501`)
    this.name = 'MoodleSourceNotProvidedError'
  }
}

// `violation` builds the rejection; the data layer passes one that logs in
// development and yields an ApiError.
export const guardMoodleBackendCall = <T>(
  embedded: boolean,
  request: () => Promise<T>,
  violation: (error: MoodleSourceNotProvidedError) => Error = (error) => error
): Promise<T> =>
  embedded ? Promise.reject(violation(new MoodleSourceNotProvidedError())) : request()
