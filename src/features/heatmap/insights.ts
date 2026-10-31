import type { CourseStats } from '../embed/protocol.ts'

// What the teacher reads off the completion counts. Pure: numbers in, numbers
// out. Nothing here reads or writes storage, the network or the console.

export interface StepInput {
  bubbleId: string
  cmid: number
  name: string
  sequence: number
}

export type HeatRow =
  | { kind: 'untracked'; bubbleId: string; cmid: number; name: string; sequence: number }
  | {
      kind: 'counts'
      bubbleId: string
      cmid: number
      name: string
      sequence: number
      students: number
      complete: number
      failed: number
      // 0 to 1
      rate: number
    }

export const percent = (rate: number): number => Math.round(rate * 100)

// Rows in the level's sequence. An activity the host does not list, or does not
// track, is "untracked": there is nothing to count for it.
export const buildHeatRows = (steps: StepInput[], stats: CourseStats): HeatRow[] => {
  const byCmid = new Map(stats.activities.map((activity) => [activity.cmid, activity]))
  return [...steps]
    .sort((a, b) => a.sequence - b.sequence)
    .map((step): HeatRow => {
      const counts = byCmid.get(step.cmid)
      const base = {
        bubbleId: step.bubbleId,
        cmid: step.cmid,
        name: step.name,
        sequence: step.sequence,
      }
      if (!counts || !counts.completionTracked || stats.tracked === 0)
        return { kind: 'untracked', ...base }
      return {
        kind: 'counts',
        ...base,
        students: stats.tracked,
        complete: counts.complete,
        failed: counts.failed,
        rate: counts.complete / stats.tracked,
      }
    })
}

export interface Insights {
  // Average completion over the tracked steps, 0 to 1; null with no tracked step.
  overall: number | null
  trackedSteps: number
  // The step where completion falls the most from the previous tracked step.
  biggestDrop: { name: string; bubbleId: string; points: number } | null
}

export const computeInsights = (rows: HeatRow[]): Insights => {
  const tracked = rows.filter((row) => row.kind === 'counts')
  if (tracked.length === 0) return { overall: null, trackedSteps: 0, biggestDrop: null }
  const overall = tracked.reduce((sum, row) => sum + row.rate, 0) / tracked.length
  let biggestDrop: Insights['biggestDrop'] = null
  for (let i = 1; i < tracked.length; i++) {
    const points = percent(tracked[i - 1].rate) - percent(tracked[i].rate)
    if (points > 0 && (!biggestDrop || points > biggestDrop.points))
      biggestDrop = { name: tracked[i].name, bubbleId: tracked[i].bubbleId, points }
  }
  return { overall, trackedSteps: tracked.length, biggestDrop }
}

// ---- Color --------------------------------------------------------------------------
// ColorBrewer "Blues", 6 classes: one hue, monotonic lightness, distinguishable
// with the common color-vision deficiencies. Lighter means fewer completed.
export const HEAT_STOPS = [
  '#eff3ff',
  '#c6dbef',
  '#9ecae1',
  '#6baed6',
  '#2171b5',
  '#08306b',
] as const

export const heatBin = (rate: number): number => {
  const clamped = Math.min(1, Math.max(0, rate))
  return Math.min(HEAT_STOPS.length - 1, Math.floor(clamped * HEAT_STOPS.length))
}

export const heatColor = (rate: number): string => HEAT_STOPS[heatBin(rate)]

// Text on top of a stop: dark ink on the four light stops, white on the rest.
export const heatTextColor = (rate: number): string => (heatBin(rate) <= 3 ? '#1f2937' : '#ffffff')

// "hace N min" from an ISO timestamp, falling back to when the numbers arrived.
export const minutesSince = (generatedAt: string, receivedAt: number, now: number): number => {
  const parsed = Date.parse(generatedAt)
  const from = Number.isFinite(parsed) && parsed <= now ? parsed : receivedAt
  return Math.max(0, Math.floor((now - from) / 60_000))
}
