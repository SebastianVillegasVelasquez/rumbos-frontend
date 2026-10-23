import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { RenderableBubble } from '../course-map/data/types.ts'
import { deriveVisualState } from '../course-map/visualState.ts'
import {
  applyHostStatus,
  availabilityFor,
  indexCourseState,
  isTrackedFor,
  resolveHostBubbles,
  statusFor,
} from './hostDerivation.ts'
import type { CourseState, HostActivity } from './protocol.ts'

const host = (cmid: number, overrides: Partial<HostActivity> = {}): HostActivity => ({
  cmid,
  name: `Actividad ${cmid}`,
  modname: 'quiz',
  sectionId: 1,
  availability: 'available',
  availabilityInfo: null,
  completion: 'incomplete',
  ...overrides,
})

const state = (activities: HostActivity[], unavailableCmids: number[] = []): CourseState => ({
  schemaVersion: 1,
  courseId: 1,
  generatedAt: '2026-01-01T00:00:00Z',
  sections: [{ id: 1, number: 1, name: 'Semana 1' }],
  activities,
  unavailableCmids,
})

const bubble = (id: string, activityId: number, sequence = 0): RenderableBubble => ({
  id,
  activityId,
  x: 0.5,
  y: 0.5,
  icon: null,
  skinId: null,
  sequence,
  status: 'locked',
})

const visual = (
  mode: 'explorative' | 'guided',
  view: 'student' | 'editor',
  index: ReturnType<typeof indexCourseState>,
  target: RenderableBubble,
  all: RenderableBubble[]
) => {
  const bubbles = applyHostStatus(index, all)
  const status = bubbles.find((b) => b.id === target.id)!
  const incomplete = bubbles
    .filter((b) => b.tracked !== false && b.status !== 'complete')
    .map((b) => b.sequence)
  return deriveVisualState({
    tracked: status.tracked,
    status: status.status,
    sequence: status.sequence,
    mode,
    availability: availabilityFor(index, target.activityId as number),
    view,
    nextIncompleteSequence: incomplete.length ? Math.min(...incomplete) : null,
  })
}

describe('statusFor', () => {
  it('maps host completion to bubble status', () => {
    assert.equal(statusFor(host(1, { completion: 'complete' })), 'complete')
    assert.equal(statusFor(host(1, { completion: 'incomplete' })), 'no_complete')
    assert.equal(statusFor(host(1, { completion: 'none' })), 'no_complete')
    assert.equal(statusFor(host(1, { completion: 'failed' })), 'in_progress')
    assert.equal(statusFor(undefined), 'no_complete')
  })
})

describe('availabilityFor', () => {
  const index = indexCourseState(
    state(
      [
        host(1),
        host(2, { availability: 'restricted' }),
        host(3, { availability: 'hidden' }),
        host(4),
      ],
      [4, 9]
    )
  )
  it('applies the shared rule', () => {
    assert.equal(availabilityFor(index, 1), 'available')
    assert.equal(availabilityFor(index, 2), 'restricted')
    assert.equal(availabilityFor(index, 3), 'hidden')
    assert.equal(availabilityFor(index, 9), 'hidden', 'unavailable cmid')
    assert.equal(availabilityFor(index, 4), 'hidden', 'unavailable wins over the activity list')
    assert.equal(availabilityFor(index, 77), 'missing', 'in neither list')
  })
})

describe('visual state from host state', () => {
  const bubbles = [bubble('a', 1, 0), bubble('b', 2, 1), bubble('c', 3, 2), bubble('d', 9, 3)]
  const index = indexCourseState(
    state(
      [
        host(1, { completion: 'complete' }),
        host(2, { availability: 'restricted', availabilityInfo: 'Completa la unidad 1' }),
        host(3, { completion: 'failed' }),
      ],
      [9]
    )
  )

  it('student, explorative', () => {
    assert.equal(visual('explorative', 'student', index, bubbles[0], bubbles), 'complete')
    assert.equal(visual('explorative', 'student', index, bubbles[1], bubbles), 'locked')
    assert.equal(visual('explorative', 'student', index, bubbles[2], bubbles), 'inProgress')
    assert.equal(visual('explorative', 'student', index, bubbles[3], bubbles), 'teaser')
  })

  it('guided mode keeps the sequence rule for incomplete activities', () => {
    const open = [bubble('a', 5, 0), bubble('b', 6, 1)]
    const idx = indexCourseState(state([host(5), host(6)]))
    assert.equal(visual('guided', 'student', idx, open[0], open), 'next')
    assert.equal(visual('guided', 'student', idx, open[1], open), 'locked')
    assert.equal(visual('explorative', 'student', idx, open[1], open), 'available')
  })

  it('a missing activity is missing for everyone', () => {
    const lost = [bubble('x', 404, 0)]
    assert.equal(visual('explorative', 'student', index, lost[0], lost), 'missing')
    assert.equal(visual('explorative', 'editor', index, lost[0], lost), 'missing')
  })
})

describe('resolveHostBubbles', () => {
  const index = indexCourseState(
    state(
      [host(1), host(2, { availability: 'hidden' }), host(3, { availability: 'restricted' })],
      [4]
    )
  )
  const bubbles = [bubble('a', 1), bubble('b', 2), bubble('c', 3), bubble('d', 4), bubble('e', 5)]

  it('gives the editor the activity behind a hidden one', () => {
    const resolved = resolveHostBubbles(index, bubbles, 'map1', true)
    assert.deepEqual(
      resolved.map((item) => [item.availability, item.activity?.activityId ?? null]),
      [
        ['available', 1],
        ['hidden', 2],
        ['restricted', 3],
        ['hidden', null],
        ['missing', null],
      ]
    )
  })

  it('withholds hidden activities from the student view', () => {
    const resolved = resolveHostBubbles(index, bubbles, 'map1', false)
    assert.equal(resolved[1].activity, null)
    assert.equal(resolved[2].activity?.activityId, 3, 'restricted stays visible')
  })

  it('never carries a url', () => {
    const [first] = resolveHostBubbles(index, bubbles, 'map1', true)
    assert.equal(first.activity?.url, '')
  })
})

describe('applyHostStatus', () => {
  it('keeps unchanged bubbles as the same object', () => {
    const idx = indexCourseState(state([host(1)]))
    const stored = { ...bubble('a', 1), status: 'no_complete' as const }
    const [result] = applyHostStatus(idx, [stored])
    assert.equal(result, stored)
  })
})

// The table the brief asks for: every completion value, in both modes and both
// roles, with the visual state a bubble ends up in.
describe('derivation table', () => {
  const rows: [HostActivity['completion'], string, string][] = [
    // completion, explorative, guided (the only bubble, so also the first)
    ['none', 'untracked', 'untracked'],
    ['incomplete', 'available', 'next'],
    ['failed', 'inProgress', 'inProgress'],
    ['complete', 'complete', 'complete'],
  ]
  for (const role of ['student', 'editor'] as const) {
    for (const [completion, explorative, guided] of rows) {
      it(`${role}: completion ${completion}`, () => {
        const idx = indexCourseState(state([host(1, { completion })]))
        const only = [bubble('a', 1, 0)]
        assert.equal(visual('explorative', role, idx, only[0], only), explorative)
        assert.equal(visual('guided', role, idx, only[0], only), guided)
      })
    }
  }

  it('an untracked activity never blocks later bubbles in guided mode', () => {
    const idx = indexCourseState(state([host(1, { completion: 'none' }), host(2), host(3)]))
    const all = [bubble('a', 1, 0), bubble('b', 2, 1), bubble('c', 3, 2)]
    assert.equal(visual('guided', 'student', idx, all[0], all), 'untracked')
    assert.equal(visual('guided', 'student', idx, all[1], all), 'next')
    assert.equal(visual('guided', 'student', idx, all[2], all), 'locked')
  })

  it('an untracked activity is open even before earlier tracked ones are done', () => {
    const idx = indexCourseState(state([host(1), host(2, { completion: 'none' })]))
    const all = [bubble('a', 1, 0), bubble('b', 2, 1)]
    assert.equal(visual('guided', 'student', idx, all[1], all), 'untracked')
  })

  it('restriction and hiding still win over "untracked"', () => {
    const idx = indexCourseState(
      state([
        host(1, { completion: 'none', availability: 'restricted' }),
        host(2, { completion: 'none', availability: 'hidden' }),
      ])
    )
    const all = [bubble('a', 1, 0), bubble('b', 2, 1)]
    assert.equal(visual('explorative', 'student', idx, all[0], all), 'locked')
    assert.equal(visual('explorative', 'student', idx, all[1], all), 'teaser')
    assert.equal(visual('explorative', 'editor', idx, all[1], all), 'untracked')
  })
})

describe('applyHostStatus tracking', () => {
  it('marks completion none as untracked and clears it when tracking appears', () => {
    const idx = indexCourseState(state([host(1, { completion: 'none' })]))
    const [off] = applyHostStatus(idx, [bubble('a', 1)])
    assert.equal(off.tracked, false)
    const [on] = applyHostStatus(indexCourseState(state([host(1)])), [off])
    assert.equal('tracked' in on, false)
  })

  it('keeps an unchanged untracked bubble as the same object', () => {
    const idx = indexCourseState(state([host(1, { completion: 'none' })]))
    const [first] = applyHostStatus(idx, [bubble('a', 1)])
    const [second] = applyHostStatus(idx, [first])
    assert.equal(second, first)
  })
})

describe('isTrackedFor', () => {
  it('is false only for completion none', () => {
    assert.equal(isTrackedFor(host(1, { completion: 'none' })), false)
    for (const completion of ['incomplete', 'complete', 'failed'] as const)
      assert.equal(isTrackedFor(host(1, { completion })), true, completion)
  })

  it('does not judge an activity the host does not list', () => {
    assert.equal(isTrackedFor(undefined), true)
  })
})
