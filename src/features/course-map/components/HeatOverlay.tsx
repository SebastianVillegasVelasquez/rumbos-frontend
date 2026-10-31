import { Circle, Group, Rect, Text } from 'react-konva'
import { heatColor, heatTextColor } from '../../heatmap/insights.ts'
import type { BubbleHeat } from '../types/course-props.types.ts'

export interface HeatItem {
  id: string
  // Design-space pixels.
  x: number
  y: number
  // The bubble's own radius.
  radius: number
  heat: BubbleHeat
}

const INK = '#12284a'
const NEUTRAL_RING = '#6b7280'
const FONT_SIZE = 20
const PILL_HEIGHT = 32

// The teacher's heat map on the canvas: a ring around each activity bubble whose
// lightness says how many students completed it, and a label with the number in
// words, so the meaning never rests on color alone. A bubble without a
// completion condition gets a dashed neutral ring and "Sin seguimiento". It
// does not listen: clicks and drags still reach the bubbles underneath.
export const HeatOverlay = ({ items }: { items: HeatItem[] }) => (
  <>
    {items.map(({ id, x, y, radius, heat }) => {
      const ring = radius * 1.3
      const untracked = heat.kind === 'untracked'
      const fill = untracked ? '#ffffff' : heatColor(heat.rate)
      const ink = untracked ? INK : heatTextColor(heat.rate)
      const width = Math.max(56, heat.badge.length * (FONT_SIZE * 0.62) + 24)
      return (
        <Group key={id} x={x} y={y} listening={false}>
          <Circle radius={ring} stroke={INK} strokeWidth={untracked ? 5 : 11} />
          <Circle
            radius={ring}
            stroke={untracked ? NEUTRAL_RING : fill}
            strokeWidth={untracked ? 3 : 7}
            dash={untracked ? [8, 7] : undefined}
          />
          <Group y={ring + 8}>
            <Rect
              x={-width / 2}
              width={width}
              height={PILL_HEIGHT}
              cornerRadius={PILL_HEIGHT / 2}
              fill={fill}
              stroke={INK}
              strokeWidth={2.5}
            />
            <Text
              x={-width / 2}
              width={width}
              height={PILL_HEIGHT}
              align="center"
              verticalAlign="middle"
              text={heat.badge}
              fontSize={FONT_SIZE}
              fontStyle="bold"
              fill={ink}
            />
          </Group>
        </Group>
      )
    })}
  </>
)
