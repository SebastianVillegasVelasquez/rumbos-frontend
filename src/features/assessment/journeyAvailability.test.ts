import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { specReply } from '../../contracts/openapiExample.ts'
import { closingEntryView } from '../hud/closingEntry.ts'
import { parseClosingStatus } from './closingStatus.ts'
import { availabilityFromStatus, markScreenSeen, wasScreenSeen } from './journeyAvailability.ts'

const status = (overrides: Record<string, unknown>) =>
  parseClosingStatus(specReply('GET', '/trainer/closing', 200, overrides))
const outcome = (finalStatus: string) => ({
  checkin: null,
  final: { status: finalStatus, reason: null, attempts: null },
  scorm_gate: { satisfied: null, reason: null },
})

describe('the HUD closing entry from the backend status', () => {
  it('is closed with the counts while content is missing', () => {
    const view = closingEntryView(
      availabilityFromStatus(
        status({
          available: false,
          reason: 'scorm_incomplete',
          progress: { completed: 2, total: 5 },
        })
      ),
      false
    )
    assert.equal(view.enabled, false)
    assert.match(view.note ?? '', /2/)
    assert.equal(view.offersContinue, true)
  })
  it('is open when the backend says it may open', () => {
    assert.equal(
      closingEntryView(availabilityFromStatus(status({ available: true })), false).enabled,
      true
    )
  })
  it('is open after a passed check-in, whatever the gate says about the final', () => {
    const passed = status({
      available: false,
      reason: 'scorm_incomplete',
      outcome: outcome('not_required_passed_checkin'),
    })
    assert.equal(closingEntryView(availabilityFromStatus(passed), false).enabled, true)
  })
  it('names each reason in words and never as a code', () => {
    for (const reason of [
      'not_enabled',
      'no_final_step',
      'form_unavailable',
      'already_passed',
      'no_attempts_left',
      'progress_unavailable',
      'user_unlinked',
    ]) {
      const view = closingEntryView(
        availabilityFromStatus(status({ available: false, reason })),
        false
      )
      assert.equal(view.enabled, false, reason)
      assert.ok(view.note && !view.note.includes('_'), reason)
    }
  })
  it('knows nothing without a status', () => {
    assert.equal(availabilityFromStatus(null), null)
  })
})

describe('the screens seen once', () => {
  const memory = () => {
    const data = new Map<string, string>()
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    } as unknown as Storage
  }
  it('are remembered per level and screen', () => {
    const storage = memory()
    assert.equal(wasScreenSeen(storage, 'map1', 'congrats_checkin'), false)
    markScreenSeen(storage, 'map1', 'congrats_checkin')
    assert.equal(wasScreenSeen(storage, 'map1', 'congrats_checkin'), true)
    assert.equal(wasScreenSeen(storage, 'map2', 'congrats_checkin'), false)
    assert.equal(wasScreenSeen(storage, 'map1', 'congrats_final'), false)
  })
  it('survive blocked storage by showing again, never by failing', () => {
    assert.equal(wasScreenSeen(null, 'map1', 'congrats_final'), false)
    markScreenSeen(null, 'map1', 'congrats_final')
  })
})
