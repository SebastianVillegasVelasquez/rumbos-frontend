import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  bigramSimilarity,
  duplicatedTargets,
  extractCodes,
  matchDescriptors,
  normalizeName,
  rankCandidates,
  tally,
  toMapping,
  type Descriptor,
  type Target,
} from './matching.ts'

const descriptor = (key: string, name: string, extra: Partial<Descriptor> = {}): Descriptor => ({
  key,
  mapRef: 'm1',
  bubbleRef: `b-${key}`,
  modname: 'quiz',
  name,
  sectionNumber: 1,
  sectionName: 'Semana 1',
  positionInSection: 1,
  ...extra,
})

const target = (cmid: number, name: string, extra: Partial<Target> = {}): Target => ({
  cmid,
  name,
  modname: 'quiz',
  sectionNumber: 1,
  sectionName: 'Semana 1',
  positionInSection: 1,
  ...extra,
})

describe('normalizeName', () => {
  const cases: [string, string][] = [
    ['Evaluación Diagnóstica', 'evaluacion diagnostica'],
    ['  ¿Qué   es   la  ÑANDÚ?  ', 'que es la nandu'],
    ['Quiz: Unidad 1 (final)', 'quiz unidad 1 final'],
    ['', ''],
  ]
  for (const [input, expected] of cases)
    it(`${JSON.stringify(input)} -> ${JSON.stringify(expected)}`, () =>
      assert.equal(normalizeName(input), expected))
})

describe('extractCodes', () => {
  it('reads bracketed codes, ignoring case and spacing', () => {
    assert.deepEqual(extractCodes('Quiz [M1E1S1]'), ['m1e1s1'])
    assert.deepEqual(extractCodes('[m1 e1] Lectura [ X-2 ]'), ['m1e1', 'x2'])
    assert.deepEqual(extractCodes('Sin código'), [])
    assert.deepEqual(extractCodes('Vacío []'), [])
  })
})

describe('bigramSimilarity', () => {
  it('is 1 for equal, 0 for disjoint and in between for near', () => {
    assert.equal(bigramSimilarity('abc', 'abc'), 1)
    assert.equal(bigramSimilarity('abc', 'xyz'), 0)
    assert.equal(bigramSimilarity('', ''), 0)
    assert.equal(bigramSimilarity('a', 'a'), 1)
    const near = bigramSimilarity('evaluacion final', 'evaluacion finals')
    assert.ok(near > 0.9 && near < 1)
  })
})

describe('matchDescriptors', () => {
  interface Case {
    name: string
    descriptors: Descriptor[]
    targets: Target[]
    placed?: number[]
    expected: { cmid: number | null; confidence: string; tier: number | null }[]
  }

  const cases: Case[] = [
    {
      name: 'same type and name, ignoring accents, case and punctuation',
      descriptors: [descriptor('a', 'Evaluación Diagnóstica')],
      targets: [target(10, 'EVALUACION   diagnostica!')],
      expected: [{ cmid: 10, confidence: 'exact', tier: 1 }],
    },
    {
      name: 'bracketed code survives a rename on the same type',
      descriptors: [descriptor('a', 'Quiz de repaso [M1E1S1]')],
      targets: [target(10, 'Autoevaluación [m1e1s1]', { sectionNumber: 4, positionInSection: 9 })],
      expected: [{ cmid: 10, confidence: 'exact', tier: 2 }],
    },
    {
      name: 'bracketed code on another type is only a suggestion',
      descriptors: [descriptor('a', 'Tarea [M1E1S1]', { modname: 'assign' })],
      targets: [target(10, 'Entrega [M1E1S1]', { sectionNumber: 4, positionInSection: 9 })],
      expected: [{ cmid: 10, confidence: 'similar', tier: 2 }],
    },
    {
      name: 'same section and position with a different name is a doubtful match',
      descriptors: [descriptor('a', 'Primer cuestionario')],
      targets: [target(10, 'Cuestionario inicial')],
      expected: [{ cmid: 10, confidence: 'similar', tier: 3 }],
    },
    {
      name: 'a renamed activity in another place matches by similarity',
      descriptors: [descriptor('a', 'Evaluación final de la unidad')],
      targets: [
        target(10, 'Evaluación final de la unidad 1', { sectionNumber: 6, positionInSection: 3 }),
      ],
      expected: [{ cmid: 10, confidence: 'similar', tier: 4 }],
    },
    {
      name: 'a clearly different name in another place does not match',
      descriptors: [descriptor('a', 'Evaluación final')],
      targets: [target(10, 'Foro de presentación', { sectionNumber: 6, positionInSection: 3 })],
      expected: [{ cmid: null, confidence: 'none', tier: null }],
    },
    {
      name: 'the same name with a different type does not match',
      descriptors: [descriptor('a', 'Unidad 1', { modname: 'quiz' })],
      targets: [target(10, 'Unidad 1', { modname: 'page' })],
      expected: [{ cmid: null, confidence: 'none', tier: null }],
    },
    {
      name: 'a different section does not break an exact name match',
      descriptors: [descriptor('a', 'Quiz 1', { sectionNumber: 1 })],
      targets: [target(10, 'Quiz 1', { sectionNumber: 5, positionInSection: 4 })],
      expected: [{ cmid: 10, confidence: 'exact', tier: 1 }],
    },
    {
      name: 'a target already placed on another level is not offered',
      descriptors: [descriptor('a', 'Quiz 1')],
      targets: [target(10, 'Quiz 1'), target(11, 'Quiz 1', { positionInSection: 2 })],
      placed: [10],
      expected: [{ cmid: 11, confidence: 'exact', tier: 1 }],
    },
    {
      name: 'when the only target is placed the row is unmatched',
      descriptors: [descriptor('a', 'Quiz 1')],
      targets: [target(10, 'Quiz 1')],
      placed: [10],
      expected: [{ cmid: null, confidence: 'none', tier: null }],
    },
    {
      name: 'duplicate names pair up by section and position, one to one',
      descriptors: [
        descriptor('a', 'Quiz', { sectionNumber: 1, positionInSection: 1 }),
        descriptor('b', 'Quiz', { sectionNumber: 2, positionInSection: 1 }),
      ],
      targets: [
        target(20, 'Quiz', { sectionNumber: 2, positionInSection: 1 }),
        target(10, 'Quiz', { sectionNumber: 1, positionInSection: 1 }),
      ],
      expected: [
        { cmid: 10, confidence: 'exact', tier: 1 },
        { cmid: 20, confidence: 'exact', tier: 1 },
      ],
    },
    {
      name: 'two descriptors never share a target',
      descriptors: [descriptor('a', 'Quiz'), descriptor('b', 'Quiz', { positionInSection: 2 })],
      targets: [target(10, 'Quiz')],
      expected: [
        { cmid: 10, confidence: 'exact', tier: 1 },
        { cmid: null, confidence: 'none', tier: null },
      ],
    },
    {
      name: 'the stronger tier wins a contested target',
      descriptors: [
        descriptor('weak', 'Cuestionario inicial'),
        descriptor('strong', 'Quiz 7', { sectionNumber: 3, positionInSection: 8 }),
      ],
      targets: [target(10, 'Quiz 7', { sectionNumber: 5, positionInSection: 2 })],
      expected: [
        { cmid: null, confidence: 'none', tier: null },
        { cmid: 10, confidence: 'exact', tier: 1 },
      ],
    },
    {
      name: 'type comparison ignores case and spaces',
      descriptors: [descriptor('a', 'Foro', { modname: 'Forum ' })],
      targets: [target(10, 'foro', { modname: 'forum' })],
      expected: [{ cmid: 10, confidence: 'exact', tier: 1 }],
    },
    {
      name: 'an empty name never counts as an exact match',
      descriptors: [descriptor('a', '', { positionInSection: 5 })],
      targets: [target(10, '', { positionInSection: 6 })],
      expected: [{ cmid: null, confidence: 'none', tier: null }],
    },
  ]

  for (const c of cases)
    it(c.name, () => {
      const result = matchDescriptors({
        descriptors: c.descriptors,
        targets: c.targets,
        placedCmids: c.placed ? new Set(c.placed) : undefined,
      })
      assert.deepEqual(
        result.map(({ cmid, confidence, tier }) => ({ cmid, confidence, tier })),
        c.expected
      )
    })

  it('is deterministic whatever the target order', () => {
    const descriptors = [descriptor('a', 'Quiz'), descriptor('b', 'Quiz', { positionInSection: 2 })]
    const targets = [target(10, 'Quiz'), target(11, 'Quiz', { positionInSection: 2 })]
    const forward = matchDescriptors({ descriptors, targets })
    const backward = matchDescriptors({ descriptors, targets: [...targets].reverse() })
    assert.deepEqual(forward, backward)
  })
})

describe('rankCandidates', () => {
  it('puts the likeliest first, skips placed ones and keeps the rest in order', () => {
    const targets = [
      target(1, 'Foro', { modname: 'forum', positionInSection: 2 }),
      target(2, 'Quiz 1'),
      target(3, 'Quiz 1 bis', { positionInSection: 3 }),
      target(4, 'Lectura', { modname: 'page', positionInSection: 4 }),
    ]
    const ranked = rankCandidates(descriptor('a', 'Quiz 1'), targets, new Set([3]))
    assert.deepEqual(
      ranked.map((item) => item.cmid),
      [2, 1, 4]
    )
  })
})

describe('review bookkeeping', () => {
  const descriptors = [
    descriptor('a', 'Quiz'),
    descriptor('b', 'Otro nombre', { sectionNumber: 2 }),
  ]
  const targets = [target(10, 'Quiz'), target(11, 'Cuestionario', { sectionNumber: 2 })]
  const matches = matchDescriptors({ descriptors, targets })

  it('builds a mapping from the proposals', () => {
    assert.deepEqual(toMapping(matches), { a: 10, b: 11 })
  })

  it('flags a target chosen twice', () => {
    assert.deepEqual([...duplicatedTargets({ a: 10, b: 10, c: null, d: null })], [10])
    assert.equal(duplicatedTargets({ a: 10, b: 11, c: null }).size, 0)
  })

  it('counts matched, doubtful and omitted rows', () => {
    assert.deepEqual(tally(toMapping(matches), matches), { matched: 1, doubtful: 1, omitted: 0 })
    assert.deepEqual(tally({ a: 10, b: null }, matches), { matched: 1, doubtful: 0, omitted: 1 })
    assert.deepEqual(tally({ a: 10, b: 11 }, matches, new Set(['b'])), {
      matched: 2,
      doubtful: 0,
      omitted: 0,
    })
  })

  it('does not count a changed exact row as exact', () => {
    assert.deepEqual(tally({ a: 11, b: null }, matches), { matched: 0, doubtful: 1, omitted: 1 })
  })
})
