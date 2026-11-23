import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { es } from '../../i18n/es.ts'
import { CLOSING_REASONS, closingEntryView, closingReasonOf } from './closingEntry.ts'

const closed = (reason: string | null, scorm?: { completed: number; required: number }) => ({
  available: false,
  reason,
  scorm,
})

describe('the closing entry in the HUD', () => {
  it('opens when the backend says so, and always for an editor in preview', () => {
    assert.deepEqual(closingEntryView({ available: true, reason: null }, false), {
      enabled: true,
      note: null,
      offersContinue: false,
    })
    assert.equal(closingEntryView(closed('scorm_incomplete'), true).enabled, true)
  })

  it('is closed when the backend gave no answer', () => {
    assert.equal(closingEntryView(undefined, false).enabled, false)
    assert.equal(closingEntryView(null, false).note, es.hud.closingReasons.other)
  })

  it('says the progress counts and offers Continuar when SCORM is incomplete', () => {
    const view = closingEntryView(closed('scorm_incomplete', { completed: 5, required: 7 }), false)
    assert.equal(view.note, 'Completa los 7 contenidos para abrir el cierre. Llevas 5.')
    assert.equal(view.offersContinue, true)
  })

  it('does not invent counts the backend did not send', () => {
    const view = closingEntryView(closed('scorm_incomplete'), false)
    assert.equal(view.note, es.hud.closingReasons.scorm_incomplete_unknown)
    assert.doesNotMatch(view.note ?? '', /\d/)
  })

  it('has a translation for every reason, and never a raw code', () => {
    for (const reason of CLOSING_REASONS) {
      const note = closingEntryView(closed(reason, { completed: 1, required: 2 }), false).note
      assert.ok(note && note.trim().length > 0, reason)
      assert.ok(!note.includes(reason), reason)
    }
    const unknown = closingEntryView(closed('a_new_backend_code'), false)
    assert.equal(unknown.note, es.hud.closingReasons.other)
    assert.equal(closingReasonOf('a_new_backend_code'), 'other')
    assert.equal(unknown.offersContinue, false)
  })
})
