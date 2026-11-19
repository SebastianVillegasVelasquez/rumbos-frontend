import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { esAssessment } from '../../i18n/assessment.es.ts'
import {
  KNOWN_LOCKED_CODES,
  lockedReasonText,
  reasonOfLockedCode,
  reasonText,
  type UnavailableReason,
} from './lockedReason.ts'
import type { AssessmentState } from './types.ts'

describe('the words for an exam that cannot be opened', () => {
  it('translates every reason the step can show', () => {
    for (const reason of Object.keys(esAssessment.step.reasons) as UnavailableReason[])
      assert.ok(reasonText(reason).trim().length > 0, reason)
  })

  it('names the final exam in the closing flow, with a sentence for every reason', () => {
    for (const reason of Object.keys(esAssessment.step.reasons) as UnavailableReason[]) {
      const text = reasonText(reason, 'final')
      assert.ok(text.trim().length > 0, reason)
      assert.doesNotMatch(text, /entrada/, reason)
    }
  })

  it('has a sentence for every code the backend is known to send', () => {
    for (const code of KNOWN_LOCKED_CODES) {
      const text = lockedReasonText(code)
      assert.ok(text && text !== code && !/[a-z]+_[a-z]+/.test(text), code)
    }
  })

  it('never shows a raw code, not even one it does not know', () => {
    assert.equal(lockedReasonText('some_new_backend_code'), esAssessment.step.reasons.locked)
    assert.equal(reasonOfLockedCode('not_available'), 'not_available')
    assert.equal(reasonOfLockedCode(null), 'locked')
    assert.equal(lockedReasonText(null), null)
  })

  it('has a label for every state the list can carry', () => {
    const states: AssessmentState[] = ['available', 'in_progress', 'exhausted', 'locked', 'passed']
    for (const state of states) assert.ok(esAssessment.finalCard.states[state], state)
  })
})
