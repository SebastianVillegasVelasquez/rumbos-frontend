import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ApiError } from '../course-map/data/apiError.ts'
import { describeImportError } from './transferErrors.ts'

const coded = (status: number, code: string, extra: Record<string, unknown> = {}) =>
  new ApiError(status, { code, message: 'x', ...extra })

describe('describeImportError', () => {
  const cases: [string, unknown, RegExp][] = [
    ['413 archive_too_large', coded(413, 'archive_too_large'), /demasiado grande/],
    ['422 archive_invalid', coded(422, 'archive_invalid'), /no es un \.rumbos válido/],
    ['422 version', coded(422, 'archive_version_unsupported'), /versión de Rumbos/],
    ['422 rights', coded(422, 'audio_rights_declaration_required'), /declaración de derechos/],
    ['422 mapping', coded(422, 'mapping_invalid'), /asignaciones no son válidas/],
    ['429', coded(429, 'rate_limited'), /muchas importaciones/],
    ['409 already applied', coded(409, 'import_already_applied'), /ya se aplicó/],
    ['409 placed', coded(409, 'activity_already_placed', { cmid: 5 }), /ya está en otro nivel/],
    ['507', coded(507, 'asset_quota_exceeded'), /espacio suficiente/],
    ['network', new ApiError(0, undefined), /conectar con el servidor/],
    ['500', coded(500, 'boom'), /Algo salió mal/],
  ]
  for (const [name, error, pattern] of cases)
    it(name, () => assert.match(describeImportError(error).message, pattern))

  it('says the import expired, for 410 and for a vanished import', () => {
    assert.equal(describeImportError(coded(410, 'import_expired')).expired, true)
    assert.equal(describeImportError(coded(404, 'import_not_found')).expired, true)
    assert.equal(describeImportError(coded(413, 'archive_too_large')).expired, undefined)
  })

  it('names the refused activity', () => {
    assert.equal(
      describeImportError(coded(409, 'activity_already_placed', { cmid: 5 })).placedCmid,
      5
    )
    assert.equal(describeImportError(coded(409, 'activity_already_placed')).placedCmid, undefined)
  })

  it('lists a few of the problems found in the archive, as plain text', () => {
    const problems = ['a', 'b', 'c', 'd', 'e', 'f', { not: 'text' }, 'x'.repeat(500)]
    const failure = describeImportError(coded(422, 'archive_invalid', { problems }))
    assert.equal(failure.details?.length, 5)
    assert.deepEqual(failure.details?.slice(0, 3), ['a', 'b', 'c'])
    assert.equal(describeImportError(coded(422, 'archive_invalid')).details?.length, 0)
  })

  it('flags a missing route as unsupported', () => {
    assert.equal(describeImportError(new ApiError(404, { detail: 'Not Found' })).unsupported, true)
  })
})
