import type { AuthRole, LaunchResult } from '../course-map/data/types.ts'
import { normalizeOrigin } from './hostOrigin.ts'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

// Accepts a positive integer, or the same number as a digit string (the
// backend may serialize Moodle ids either way).
const asCourseId = (value: unknown): number | null => {
  const id = typeof value === 'string' && /^\d{1,12}$/.test(value) ? Number(value) : value
  return typeof id === 'number' && Number.isSafeInteger(id) && id > 0 ? id : null
}

// Validates the POST /auth/launch answer before trusting any part of it.
export const parseLaunchResult = (value: unknown): LaunchResult | null => {
  if (!isRecord(value)) return null
  const { accessToken, tokenType, expiresIn, role, hostOrigin } = value
  const courseId = asCourseId(value.courseId)
  if (typeof accessToken !== 'string' || accessToken.length === 0 || accessToken.length > 4_096)
    return null
  if (tokenType !== 'Bearer') return null
  if (typeof expiresIn !== 'number' || !Number.isFinite(expiresIn) || expiresIn <= 0) return null
  if (role !== 'editor' && role !== 'student') return null
  if (courseId === null || typeof hostOrigin !== 'string') return null
  return { accessToken, tokenType, expiresIn, role: role as AuthRole, courseId, hostOrigin }
}

// The tenant's registered host must be the page that actually embeds us.
export const hostOriginMatches = (reported: string, expected: string) =>
  normalizeOrigin(reported) === expected
