import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { esAssessment } from '../../../i18n/assessment.es.ts'
import type { FailureKind } from '../../assessment/examReducer.ts'
import {
  KNOWN_LOCKED_CODES,
  reasonOfLockedCode,
  reasonText,
} from '../../assessment/lockedReason.ts'

// The words of the final-assessment step, as StepAssessment merges them.
const final = { ...esAssessment.step, ...esAssessment.stepFinal }

const filled = (value: unknown) =>
  typeof value === 'function' ? true : typeof value === 'string' && value.trim().length > 0

describe('the final-assessment step has words for every state', () => {
  it('loading, available, in progress, submitted, passed, exhausted, unreachable', () => {
    for (const key of [
      'checking',
      'available',
      'inProgress',
      'open',
      'resume',
      'done',
      'passed',
      'passedNote',
      'exhausted',
      'unreachable',
      'unreachableHelp',
      'retry',
      'skip',
      'skipNote',
      'editorNote',
    ] as const)
      assert.ok(filled(final[key]), key)
    assert.match(final.inProgress('10:00'), /10:00/)
  })

  it('names the final exam, not the check-in', () => {
    for (const key of ['available', 'exhausted', 'skipNote'] as const)
      assert.doesNotMatch(final[key], /entrada/, key)
  })

  it('has a sentence for every reason it can be unavailable, and never a raw code', () => {
    for (const reason of Object.keys(final.reasons) as (keyof typeof final.reasons)[]) {
      const text = reasonText(reason, 'final')
      assert.ok(filled(text), reason)
      assert.ok(!text.includes('_'), reason)
    }
    for (const code of KNOWN_LOCKED_CODES)
      assert.ok(filled(reasonText(reasonOfLockedCode(code), 'final')), code)
  })

  it('has a sentence for every failure the runner can report, the closing guard included', () => {
    const kinds: Record<FailureKind, true> = {
      unreachable: true,
      unauthorized: true,
      no_attempts_left: true,
      locked: true,
      closing_not_available: true,
      closed: true,
      other: true,
    }
    for (const kind of Object.keys(kinds) as FailureKind[])
      assert.ok(filled(esAssessment.errors[kind]), kind)
  })

  it('labels the preview so it cannot pass for a real attempt', () => {
    assert.match(esAssessment.previewFinal, /no se guarda ni cuenta/)
    assert.ok(filled(esAssessment.previewResult))
  })
})
