import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { ApiError } from '../course-map/data/apiError.ts'
import type { CourseState } from '../embed/protocol.ts'
import { descriptorsFor, targetsFromCourseState } from './courseTargets.ts'
import { exportFilename, slugify } from './exportFilename.ts'
import { describeExportError } from './transferErrors.ts'
import {
  getTransferSupport,
  isMissingRoute,
  learnFromTransferError,
  resetTransferSupport,
} from './transferSupport.ts'

const state: CourseState = {
  schemaVersion: 1,
  courseId: 7,
  generatedAt: '2026-01-01T00:00:00Z',
  sections: [
    { id: 10, number: 1, name: 'Semana 1' },
    { id: 20, number: 2, name: 'Semana 2' },
  ],
  activities: [
    {
      cmid: 1,
      name: 'A',
      modname: 'quiz',
      sectionId: 10,
      availability: 'available',
      availabilityInfo: null,
      completion: 'none',
    },
    {
      cmid: 2,
      name: 'B',
      modname: 'page',
      sectionId: 20,
      availability: 'available',
      availabilityInfo: null,
      completion: 'none',
    },
    {
      cmid: 3,
      name: 'C',
      modname: 'url',
      sectionId: 10,
      availability: 'hidden',
      availabilityInfo: null,
      completion: 'none',
    },
  ],
  unavailableCmids: [],
}

describe('targetsFromCourseState', () => {
  it('numbers the position inside each section, from 1, in course order', () => {
    const targets = targetsFromCourseState(state)
    assert.deepEqual(
      targets.map((t) => [t.cmid, t.sectionNumber, t.sectionName, t.positionInSection]),
      [
        [1, 1, 'Semana 1', 1],
        [2, 2, 'Semana 2', 1],
        [3, 1, 'Semana 1', 2],
      ]
    )
  })

  it('describes only the activities a level uses', () => {
    const used = descriptorsFor([3, 1, 99], targetsFromCourseState(state))
    assert.deepEqual(
      used.map((t) => t.cmid),
      [1, 3]
    )
  })
})

describe('exportFilename', () => {
  const cases: [string | null, string][] = [
    ['Introducción a la Ecología', 'rumbos-introduccion-a-la-ecologia-2026-03-07.rumbos'],
    ['  Curso: ¡Álgebra & más!  ', 'rumbos-curso-algebra-mas-2026-03-07.rumbos'],
    [null, 'rumbos-curso-2026-03-07.rumbos'],
    ['???', 'rumbos-curso-2026-03-07.rumbos'],
  ]
  for (const [name, expected] of cases)
    it(`${JSON.stringify(name)} -> ${expected}`, () =>
      assert.equal(exportFilename(name, new Date(2026, 2, 7, 23, 59)), expected))

  it('caps a long course name', () => {
    assert.ok(slugify('x'.repeat(200)).length <= 40)
  })
})

describe('describeExportError', () => {
  const coded = (status: number, code: string) => new ApiError(status, { code, message: 'x' })
  const cases: [string, unknown, RegExp][] = [
    ['404', coded(404, 'map_not_found'), /ya no existe/],
    ['409 never_saved', coded(409, 'never_saved'), /todavía no se ha guardado/],
    ['413', coded(413, 'export_too_large'), /demasiado grande/],
    ['422', coded(422, 'export_invalid'), /impide crear el archivo/],
    ['network', new ApiError(0, undefined), /conectar con el servidor/],
    ['403', coded(403, 'forbidden'), /No tienes permiso/],
    ['500', coded(500, 'boom'), /Algo salió mal/],
    ['not an ApiError', new Error('x'), /Algo salió mal/],
  ]
  for (const [name, error, pattern] of cases)
    it(name, () => assert.match(describeExportError(error).message, pattern))
})

describe('transfer support', () => {
  afterEach(() => resetTransferSupport())

  it('a bare 404, 405 or 501 means the routes are missing', () => {
    for (const status of [404, 405, 501]) {
      assert.equal(isMissingRoute(new ApiError(status, { detail: 'Not Found' })), true)
      assert.equal(isMissingRoute(new ApiError(status, 'Not Found')), true)
    }
  })

  it('a coded answer or another status is a real answer', () => {
    assert.equal(isMissingRoute(new ApiError(404, { code: 'map_not_found', message: 'x' })), false)
    assert.equal(isMissingRoute(new ApiError(500, 'oops')), false)
    assert.equal(isMissingRoute(new ApiError(0, undefined)), false)
    assert.equal(isMissingRoute(new Error('x')), false)
  })

  it('hides the entry points only once a call proves it', () => {
    assert.equal(getTransferSupport(), 'unknown')
    learnFromTransferError(new ApiError(500, 'oops'))
    assert.equal(getTransferSupport(), 'unknown')
    learnFromTransferError(new ApiError(404, { detail: 'Not Found' }))
    assert.equal(getTransferSupport(), 'no')
  })

  it('flags the unsupported failure for the dialogs', () => {
    assert.equal(describeExportError(new ApiError(404, { detail: 'Not Found' })).unsupported, true)
  })
})
