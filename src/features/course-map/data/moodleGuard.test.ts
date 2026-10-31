import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, it } from 'node:test'
import { guardMoodleBackendCall, MOODLE_SOURCE_NOT_PROVIDED } from './moodleGuard.ts'

describe('guardMoodleBackendCall', () => {
  it('never reaches the network in embed mode', async () => {
    let fetched = 0
    const request = async () => {
      fetched++
      return 'data'
    }
    await assert.rejects(
      guardMoodleBackendCall(true, request),
      (error: { status: number; body: { code: string } }) =>
        error.status === 501 && error.body.code === MOODLE_SOURCE_NOT_PROVIDED
    )
    assert.equal(fetched, 0)
  })

  it('passes the request through outside embed mode', async () => {
    assert.equal(await guardMoodleBackendCall(false, async () => 'data'), 'data')
  })
})

// The three Moodle-backed endpoints may only be reached through these files:
// the backend Moodle source (never installed in embed mode) and the create-level
// and export dialogs, which skip the query when embedded. Everything else reads Moodle data
// from the MoodleState the app gives it.
const ALLOWED = new Set([
  'features/course-map/data/queries.ts',
  'features/course-map/data/courseMapApi.ts',
  'features/course-map/data/mockCourseMapApi.ts',
  'features/course-map/data/mockAuth.ts',
  'features/course-map/moodle/backendMoodleState.ts',
  'features/course-map/components/CourseLevels.tsx',
  'features/transfer/useCourseTargets.ts',
])
const FORBIDDEN =
  /\b(useActivities|useResolvedCourseMap|usePublishedResolvedCourseMap|getActivities|getResolvedCourseMap|getPublishedResolvedCourseMap)\b/

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts') ? [path] : []
  })

describe('Moodle-backed endpoints', () => {
  it('are only reachable from the allowed files', () => {
    const root = join(import.meta.dirname, '..', '..', '..')
    const offenders = sourceFiles(root)
      .map((file) => relative(root, file).split(sep).join('/'))
      .filter((file) => !ALLOWED.has(file))
      .filter((file) => FORBIDDEN.test(readFileSync(join(root, file), 'utf8')))
    assert.deepEqual(offenders, [])
  })
})
