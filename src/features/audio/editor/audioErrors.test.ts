import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { checkAudioForm, classifyAudioError, formatDuration } from './audioErrors.ts'

describe('classifyAudioError', () => {
  it('maps each contract code', () => {
    for (const code of [
      'audio_rights_declaration_required',
      'audio_credit_required',
      'audio_invalid',
      'audio_too_long',
      'asset_too_large',
      'audio_uploads_disabled',
    ]) {
      assert.equal(classifyAudioError({ status: 422, code }), code)
    }
  })

  it('falls back on the status when the body has no code', () => {
    assert.equal(classifyAudioError({ status: 413, code: undefined }), 'asset_too_large')
    assert.equal(classifyAudioError({ status: 503, code: undefined }), 'audio_uploads_disabled')
  })

  it('tells an unreachable server and an unknown failure apart', () => {
    assert.equal(classifyAudioError({ status: 0, code: undefined }), 'unreachable')
    assert.equal(classifyAudioError({ status: 500, code: 'boom' }), 'unknown')
    assert.equal(classifyAudioError({ status: 422, code: 'something_else' }), 'unknown')
  })
})

describe('checkAudioForm', () => {
  const ok = {
    file: { type: 'audio/mpeg', size: 1_000_000 },
    title: 'Brisa',
    credit: 'Autor, CC BY 4.0',
    declared: true,
  }

  it('accepts a complete form', () => {
    assert.equal(checkAudioForm(ok), null)
    assert.equal(
      checkAudioForm({ ...ok, file: { type: 'audio/mp4', size: 8 * 1024 * 1024 } }),
      null
    )
  })

  it('requires the file, a valid type, and at most 8 MB', () => {
    assert.equal(checkAudioForm({ ...ok, file: null }), 'noFile')
    assert.equal(checkAudioForm({ ...ok, file: { type: 'audio/wav', size: 10 } }), 'notAudio')
    assert.equal(
      checkAudioForm({ ...ok, file: { type: 'audio/mpeg', size: 8 * 1024 * 1024 + 1 } }),
      'tooLarge'
    )
  })

  it('requires a title, a credit and the rights declaration', () => {
    assert.equal(checkAudioForm({ ...ok, title: '  ' }), 'noTitle')
    assert.equal(checkAudioForm({ ...ok, credit: '' }), 'noCredit')
    assert.equal(checkAudioForm({ ...ok, declared: false }), 'noDeclaration')
  })
})

describe('formatDuration', () => {
  it('formats m:ss and tolerates missing values', () => {
    assert.equal(formatDuration(65), '1:05')
    assert.equal(formatDuration(600), '10:00')
    assert.equal(formatDuration(null), '')
    assert.equal(formatDuration(-3), '')
  })
})
