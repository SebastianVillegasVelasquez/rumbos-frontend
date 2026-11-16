import type { FlowMode } from './flowReducer.ts'

// Where the flow shows. The host decides the height of the inline frame (a fixed
// 500-700 px in a course), which the app cannot change, so while the flow is
// mandatory and unfinished the viewer lands in the flow's own full-viewport stage
// (the host's fullscreen) instead of the small inline card. Inline stays for the
// editor's preview, for a review, and once the flow is over.
export const wantsFullStage = (input: {
  // Inside the host (a standalone app has no frame to grow).
  embedded: boolean
  mode: FlowMode
  hasMandatoryStep: boolean
}): boolean => input.embedded && input.mode === 'normal' && input.hasMandatoryStep
