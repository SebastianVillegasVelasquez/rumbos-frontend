import { es } from '../../i18n/es.ts'
import type { BubbleHeat } from '../course-map/types/course-props.types.ts'
import { percent, type HeatRow } from './insights.ts'

const text = es.heatmap

// What the canvas gets for each bubble: a rate for the color and words for the
// label and the details. Percentages are never carried by color alone.
export const overlayFor = (rows: HeatRow[]): Map<string, BubbleHeat> =>
  new Map(
    rows.map((row): [string, BubbleHeat] => {
      if (row.kind === 'untracked')
        return [
          row.bubbleId,
          { kind: 'untracked', rate: 0, badge: text.untracked, detail: text.untrackedDetail },
        ]
      const pct = percent(row.rate)
      return [
        row.bubbleId,
        {
          kind: 'counts',
          rate: row.rate,
          badge: text.badge(pct),
          detail: text.detail(row.complete, row.students, pct, row.failed),
        },
      ]
    })
  )
