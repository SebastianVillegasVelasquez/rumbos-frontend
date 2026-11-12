import type { WelcomeStep } from '../../course-map/data/types.ts'

// The to-do an author sees after an import (the import warnings flow_quiz_unlinked
// and document_dropped), derived from the flow itself instead of remembered:
// it is true whenever the flow is in that state, so it also catches a step that
// was left unlinked by hand, and it disappears the moment it is fixed.
export type FlowFlag = 'flow_quiz_unlinked' | 'document_dropped'

export const flowFlags = (
  steps: readonly WelcomeStep[],
  // Asset ids of documents the server can serve; undefined while not known.
  availableDocuments: ReadonlySet<string> | undefined
): FlowFlag[] => {
  const flags: FlowFlag[] = []
  if (steps.some((step) => step.type === 'quiz' && step.cmid === null))
    flags.push('flow_quiz_unlinked')
  if (
    steps.some(
      (step) =>
        step.type === 'pdf' &&
        (step.assetId === '' ||
          (availableDocuments !== undefined && !availableDocuments.has(step.assetId)))
    )
  )
    flags.push('document_dropped')
  return flags
}
