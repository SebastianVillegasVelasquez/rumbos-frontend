import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { CourseStats } from '../embed/protocol.ts'
import {
  HEAT_STOPS,
  buildHeatRows,
  computeInsights,
  heatBin,
  heatColor,
  heatTextColor,
  minutesSince,
  percent,
} from './insights.ts'

const stats = (
  activities: CourseStats['activities'],
  extra: Partial<CourseStats> = {}
): CourseStats => ({
  schemaVersion: 1,
  generatedAt: '2026-01-01T00:00:00Z',
  courseId: 7,
  groupId: 0,
  groups: [],
  tracked: 20,
  minCohort: 5,
  suppressed: false,
  activities,
  ...extra,
})

const steps = [
  { bubbleId: 'b3', cmid: 3, name: 'Tercera', sequence: 3 },
  { bubbleId: 'b1', cmid: 1, name: 'Primera', sequence: 1 },
  { bubbleId: 'b2', cmid: 2, name: 'Segunda', sequence: 2 },
  { bubbleId: 'b4', cmid: 4, name: 'Sin seguimiento', sequence: 4 },
]

const sample = stats([
  { cmid: 1, completionTracked: true, complete: 20, failed: 0 },
  { cmid: 2, completionTracked: true, complete: 16, failed: 2 },
  { cmid: 3, completionTracked: true, complete: 8, failed: 1 },
  { cmid: 4, completionTracked: false, complete: 0, failed: 0 },
])

describe('buildHeatRows', () => {
  const rows = buildHeatRows(steps, sample)

  it('follows the level sequence', () => {
    assert.deepEqual(
      rows.map((row) => row.bubbleId),
      ['b1', 'b2', 'b3', 'b4']
    )
  })

  it('computes complete over tracked students', () => {
    const second = rows[1]
    assert.equal(second.kind, 'counts')
    if (second.kind === 'counts') {
      assert.equal(second.rate, 0.8)
      assert.equal(second.failed, 2)
      assert.equal(second.students, 20)
    }
  })

  it('shows an activity without a completion condition as untracked', () => {
    assert.equal(rows[3].kind, 'untracked')
  })

  it('treats an activity the host did not list as untracked', () => {
    const lone = [{ bubbleId: 'x', cmid: 99, name: 'X', sequence: 1 }]
    assert.equal(buildHeatRows(lone, sample)[0].kind, 'untracked')
  })

  it('has no counts when nobody is tracked', () => {
    const empty = buildHeatRows(steps, stats(sample.activities, { tracked: 0 }))
    assert.ok(empty.every((row) => row.kind === 'untracked'))
  })
})

describe('computeInsights', () => {
  it('finds the biggest drop between consecutive tracked steps', () => {
    const insights = computeInsights(buildHeatRows(steps, sample))
    assert.equal(insights.trackedSteps, 3)
    assert.equal(insights.biggestDrop?.name, 'Tercera')
    assert.equal(insights.biggestDrop?.points, 40)
    assert.equal(percent(insights.overall ?? 0), 73)
  })

  it('skips untracked steps when pairing consecutive ones', () => {
    const rows = buildHeatRows(
      [
        { bubbleId: 'a', cmid: 1, name: 'A', sequence: 1 },
        { bubbleId: 'u', cmid: 4, name: 'U', sequence: 2 },
        { bubbleId: 'c', cmid: 3, name: 'C', sequence: 3 },
      ],
      sample
    )
    assert.equal(computeInsights(rows).biggestDrop?.name, 'C')
  })

  it('reports no drop when completion never falls', () => {
    const rising = stats([
      { cmid: 1, completionTracked: true, complete: 5, failed: 0 },
      { cmid: 2, completionTracked: true, complete: 10, failed: 0 },
    ])
    const rows = buildHeatRows(steps.slice(1, 3), rising)
    assert.equal(computeInsights(rows).biggestDrop, null)
  })

  it('has nothing to say without tracked steps', () => {
    assert.deepEqual(computeInsights([]), { overall: null, trackedSteps: 0, biggestDrop: null })
  })
})

const channel = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16) / 255))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

describe('color', () => {
  it('maps rates onto the six stops, lighter for fewer', () => {
    assert.equal(heatBin(0), 0)
    assert.equal(heatBin(0.5), 3)
    assert.equal(heatBin(1), HEAT_STOPS.length - 1)
    assert.equal(heatBin(-3), 0)
    assert.equal(heatBin(7), HEAT_STOPS.length - 1)
    assert.equal(heatColor(0), HEAT_STOPS[0])
  })

  it('gets darker with every stop', () => {
    for (let i = 1; i < HEAT_STOPS.length; i++)
      assert.ok(luminance(HEAT_STOPS[i]) < luminance(HEAT_STOPS[i - 1]))
  })

  it('keeps label text readable on every stop (4.5:1)', () => {
    for (let bin = 0; bin < HEAT_STOPS.length; bin++) {
      const rate = (bin + 0.5) / HEAT_STOPS.length
      const [hi, lo] = [luminance(heatColor(rate)), luminance(heatTextColor(rate))].sort(
        (x, y) => y - x
      )
      assert.ok((hi + 0.05) / (lo + 0.05) >= 4.5, `stop ${bin}`)
    }
  })
})

describe('minutesSince', () => {
  const now = Date.parse('2026-01-01T00:10:00Z')

  it('counts whole minutes from the host timestamp', () => {
    assert.equal(minutesSince('2026-01-01T00:00:00Z', 0, now), 10)
    assert.equal(minutesSince('2026-01-01T00:09:30Z', 0, now), 0)
  })

  it('falls back to the arrival time for a bad or future timestamp', () => {
    assert.equal(minutesSince('nope', now - 120_000, now), 2)
    assert.equal(minutesSince('2030-01-01T00:00:00Z', now - 60_000, now), 1)
  })
})
