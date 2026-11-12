import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { WelcomeStep } from '../../course-map/data/types.ts'
import { flowFlags } from './flowFlags.ts'

const base = { title: 'T', mandatory: true, revision: 1 }
const quiz = (cmid: number | null): WelcomeStep => ({
  ...base,
  key: 'quizkey001',
  type: 'quiz',
  cmid,
  intro: null,
  outcomeAbove: null,
  outcomeBelow: null,
})
const pdf = (assetId: string): WelcomeStep => ({
  ...base,
  key: 'pdfkey0001',
  type: 'pdf',
  assetId,
  ack: null,
  minSeconds: 0,
})

describe('the import to-do derived from the flow', () => {
  it('flags a quiz step that is not linked', () => {
    assert.deepEqual(flowFlags([quiz(null)], undefined), ['flow_quiz_unlinked'])
    assert.deepEqual(flowFlags([quiz(101)], undefined), [])
  })
  it('flags a document step with no document or one the server cannot serve', () => {
    assert.deepEqual(flowFlags([pdf('')], undefined), ['document_dropped'])
    assert.deepEqual(flowFlags([pdf('a')], new Set(['b'])), ['document_dropped'])
    assert.deepEqual(flowFlags([pdf('a')], new Set(['a'])), [])
  })
  it('does not guess about a document while the list is unknown', () => {
    assert.deepEqual(flowFlags([pdf('a')], undefined), [])
  })
  it('says nothing for a clean flow', () => {
    assert.deepEqual(flowFlags([], new Set()), [])
  })
})
