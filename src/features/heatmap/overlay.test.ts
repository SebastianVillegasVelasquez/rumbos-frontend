import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { HeatRow } from './insights.ts'
import { overlayFor } from './overlay.ts'

const rows: HeatRow[] = [
  {
    kind: 'counts',
    bubbleId: 'a',
    cmid: 1,
    name: 'Primera',
    sequence: 1,
    students: 19,
    complete: 12,
    failed: 3,
    rate: 12 / 19,
  },
  { kind: 'untracked', bubbleId: 'b', cmid: 2, name: 'Segunda', sequence: 2 },
]

describe('overlayFor', () => {
  const overlay = overlayFor(rows)

  it('words the details the way the teacher reads them', () => {
    assert.equal(overlay.get('a')?.detail, 'Completaron 12 de 19 (63 %) · No aprobaron: 3')
    assert.equal(overlay.get('a')?.badge, '63 %')
    assert.equal(overlay.get('a')?.kind, 'counts')
  })

  it('shows an untracked bubble as such, in words', () => {
    assert.equal(overlay.get('b')?.kind, 'untracked')
    assert.equal(overlay.get('b')?.badge, 'Sin seguimiento')
  })

  it('carries a rate and text, never the counts', () => {
    assert.deepEqual(Object.keys(overlay.get('a')!).sort(), ['badge', 'detail', 'kind', 'rate'])
  })
})
