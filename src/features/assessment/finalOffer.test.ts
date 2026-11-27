import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { validated } from '../../contracts/openapiExample.ts'
import { parseClosingStatus } from './closingStatus.ts'
import { finalOfferOf } from './finalOffer.ts'

// While the gate is on, the final comes from GET /trainer/closing. Every body here is checked
// against contracts/openapi.json.

// `state: locked` on purpose: the item's own state must not decide anything.
const item = {
  purpose: 'final',
  title: 'Evaluación final',
  section_count: 5,
  item_count: 40,
  attempts: { used: 1, max: 3 },
  state: 'locked',
  locked_reason: 'not_available',
  in_progress: null,
  best: null,
}

const status = (
  final: string,
  { reason = null as string | null, own = {} as object | null } = {}
) =>
  parseClosingStatus(
    validated('GET', '/trainer/closing', 200, {
      enforced: false,
      preview: false,
      available: final === 'required',
      reason,
      final: own === null ? null : { ...item, ...own },
      outcome: {
        checkin: null,
        final: {
          status: final,
          reason,
          attempts: { used: 1, max: 3 },
          percent: null,
          pass_percent: 80,
          pass_operator: 'gt',
        },
        scorm_gate: { satisfied: null, reason: 'not_checked' },
      },
    })
  )

describe('the final exam while the closing gate is on', () => {
  it('required: ready to sit, whatever the item’s own state says', () => {
    const offer = finalOfferOf(status('required'))
    assert.equal(offer?.kind, 'ready')
    assert.equal(offer?.kind === 'ready' && offer.item.state, 'available')
    assert.equal(offer?.kind === 'ready' && offer.item.locked_reason, null)
  })
  it('required with an attempt open: to be resumed', () => {
    const open = { attempt_id: 'a1', deadline_at: '2026-11-27T20:00:00Z' }
    const offer = finalOfferOf(status('required', { own: { in_progress: open } }))
    assert.equal(offer?.kind === 'ready' && offer.item.state, 'in_progress')
  })
  it('attempts spent: nothing left to sit', () => {
    const offer = finalOfferOf(status('exhausted'))
    assert.equal(offer?.kind === 'ready' && offer.item.state, 'exhausted')
  })
  it('passed, or exempt by the check-in: done', () => {
    for (const final of ['passed', 'not_required_passed_checkin'])
      assert.deepEqual(finalOfferOf(status(final)), { kind: 'passed' }, final)
  })
  it('locked: said in words, never offered', () => {
    assert.deepEqual(finalOfferOf(status('locked', { reason: 'scorm_incomplete' })), {
      kind: 'unavailable',
      reason: 'scorm_incomplete',
    })
    assert.deepEqual(finalOfferOf(status('locked', { reason: 'progress_unavailable' })), {
      kind: 'unavailable',
      reason: 'locked',
    })
  })
  it('offers nothing without a final exam, or with the gate off', () => {
    assert.equal(finalOfferOf(status('required', { own: null })), null)
    const off = parseClosingStatus(
      validated('GET', '/trainer/closing', 200, {
        enforced: false,
        preview: false,
        available: true,
        reason: null,
        final: item,
      })
    )
    assert.equal(finalOfferOf(off), null)
  })
})
