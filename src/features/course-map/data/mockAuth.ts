// The mock backend's half of embed mode: it exchanges the mock host's
// assertion for a token and enforces the same access matrix as the real
// backend (contract v5), so embed behavior can be demoed without a server.
//
// Only active once the embed session installed its auth hooks; the standalone
// mock stays open like before.
import { decodeMockAssertion } from '../../embed/mockAssertion.ts'
import { ApiError, getAuthToken, hasAuthHooks, retryOnUnauthorized } from './client.ts'
import type { AuthRole, LaunchResult } from './types.ts'

interface MockToken {
  role: AuthRole
  course: number
  expiresAt: number
}

const DEFAULT_TOKEN_TTL_S = 900

const tokens = new Map<string, MockToken>()
const usedAssertions = new Set<string>()

const randomToken = () => `mock-${crypto.randomUUID()}`

const apiError = (status: number, code: string, message: string) =>
  new ApiError(status, { code, message })

export const mockLaunch = (assertion: string): LaunchResult => {
  const claims = decodeMockAssertion(assertion)
  if (!claims || claims.exp * 1000 < Date.now() || usedAssertions.has(claims.jti)) {
    // Expired, forged and replayed assertions all look the same from outside.
    throw apiError(401, 'launch_invalid', 'The launch assertion is not valid.')
  }
  if (claims.tenantDisabled) {
    throw apiError(403, 'tenant_disabled', 'This site is not enabled.')
  }
  usedAssertions.add(claims.jti)
  const ttl = claims.ttl ?? DEFAULT_TOKEN_TTL_S
  const accessToken = randomToken()
  tokens.set(accessToken, {
    role: claims.role,
    course: claims.course,
    expiresAt: Date.now() + ttl * 1000,
  })
  return {
    accessToken,
    tokenType: 'Bearer',
    expiresIn: ttl,
    role: claims.role,
    courseId: claims.course,
    hostOrigin: claims.host,
  }
}

// Dev tool (the mock host's "expire token" button): every issued token stops
// working, so the next call answers 401 like a real expiry.
export const expireMockTokens = () => tokens.clear()

const requireSession = (): MockToken => {
  const token = getAuthToken()
  const session = token ? tokens.get(token) : undefined
  if (!session || session.expiresAt < Date.now()) {
    throw apiError(401, 'token_invalid', 'The access token is missing, invalid or expired.')
  }
  return session
}

// Students may only read published maps of their own course.
const STUDENT_METHODS = new Set(['listPublishedCourseMaps', 'getPublishedCourseMap'])

// The host provides this data in plugin mode.
const HOST_PROVIDED_METHODS = new Set([
  'getActivities',
  'getResolvedCourseMap',
  'getPublishedResolvedCourseMap',
])

// Methods whose first argument is a course map id (cross-course answers 404).
const MAP_BOUND_METHODS = new Set([
  'getCourseMap',
  'patchCourseMap',
  'deleteCourseMap',
  'updateAppearance',
  'updateView3d',
  'createBubble',
  'updateBubble',
  'deleteBubble',
  'reorderBubbles',
  'getPublicationState',
  'publish',
  'listPublications',
  'discardChanges',
  'restorePublication',
  'getPublishedCourseMap',
])

// Methods that name a Moodle course in their first argument.
const COURSE_BOUND_METHODS: Record<string, (arg: unknown) => number | undefined> = {
  listCourseMaps: (params) => (params as { moodleCourseId?: number }).moodleCourseId,
  listPublishedCourseMaps: (params) => (params as { moodleCourseId?: number }).moodleCourseId,
  createCourseMap: (input) => (input as { moodleCourseId: number }).moodleCourseId,
  reorderCourseMaps: (input) => (input as { moodleCourseId: number }).moodleCourseId,
}

const notFound = () => apiError(404, 'not_found', 'Resource not found.')

export const authorizeMockCall = (
  method: string,
  args: unknown[],
  courseOfMap: (courseMapId: string) => number | null
) => {
  if (method === 'launch' || !hasAuthHooks()) return
  const session = requireSession()

  if (session.role === 'student' && !STUDENT_METHODS.has(method)) {
    throw apiError(403, 'forbidden', 'Students cannot use this endpoint.')
  }
  if (HOST_PROVIDED_METHODS.has(method)) {
    throw apiError(501, 'moodle_source_not_provided', 'The host provides this data.')
  }
  if (MAP_BOUND_METHODS.has(method) && courseOfMap(String(args[0])) !== session.course) {
    throw notFound()
  }
  const course = COURSE_BOUND_METHODS[method]?.(args[0])
  if (course !== undefined && course !== session.course) throw notFound()
}

// Wraps the mock so each call is authorized first and, like the real client,
// is retried once after the embed session refreshed an expired token.
export const withMockAuth = <T extends object>(
  api: T,
  courseOfMap: (courseMapId: string) => number | null
): T =>
  Object.fromEntries(
    Object.entries(api).map(([name, fn]) => [
      name,
      (...args: unknown[]) =>
        retryOnUnauthorized(async () => {
          authorizeMockCall(name, args, courseOfMap)
          return (fn as (...a: unknown[]) => unknown)(...args)
        }),
    ])
  ) as T
