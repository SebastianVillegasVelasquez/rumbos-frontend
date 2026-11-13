import { isDone, type FlowState } from './flowReducer.ts'

// The segments of the flow's progress bar, derived from the one state that also
// drives the "Paso N de M" label (`state.index`). A segment is exactly one of:
//   current  - the step on screen (the only one that is "where you are");
//   done     - completed at its current revision;
//   visited  - reached before but not done (the furthest-reached steps a viewer
//              went back from): it is available, not current;
//   locked   - not reachable yet.
// `done` also rides on the current segment, so a finished step you came back to
// still says so. Pure: no React, no DOM.

export type SegmentKind = 'current' | 'done' | 'visited' | 'locked'

export interface Segment {
  index: number
  key: string
  kind: SegmentKind
  done: boolean
  reachable: boolean
}

export const stepperSegments = (state: FlowState): Segment[] =>
  state.steps.map((step, index) => {
    const done = isDone(state, step)
    const reachable = state.mode === 'review' || index <= state.furthest
    const kind: SegmentKind =
      index === state.index ? 'current' : done ? 'done' : reachable ? 'visited' : 'locked'
    return { index, key: step.key, kind, done, reachable }
  })
