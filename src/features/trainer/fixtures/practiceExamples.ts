import real from './practiceExamples.json' with { type: 'json' }

// Request and response examples of the practice sessions as the backend documents them
// (rumbos-backend/docs/TRAINER-API-EXAMPLES.md, captured from the running API on a small
// fictitious pack: ids replaced by fixed fake ones). Verbatim: do not edit by hand, copy
// them again when the backend's change. A fresh copy each time, so a test can break one
// without touching the others.
export type PracticeExamples = typeof real
export const practiceExamples = (): PracticeExamples => structuredClone(real)
