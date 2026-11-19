import type { TrainerLevel } from './types.ts'

// How much help the practice gives at each level, as data (not branches in the
// screens). A1 and A2 have content; the other levels exist so the same screens
// render with less help when their content arrives. The server decides which steps
// exist; this decides which aids are shown around them.

export interface Scaffolding {
  // "Ver en español" on the partner's line.
  translation: boolean
  // Sentence starters and the word bank beside a typed turn.
  starters: boolean
  wordBank: boolean
  // The step's hint.
  hints: boolean
  // Slow audio (0.75x) and the transcript after listening.
  slowAudio: boolean
}

export const SCAFFOLDING: Record<TrainerLevel, Scaffolding> = {
  A1: { translation: true, starters: true, wordBank: true, hints: true, slowAudio: true },
  A2: { translation: true, starters: true, wordBank: false, hints: true, slowAudio: true },
  B1: { translation: false, starters: false, wordBank: false, hints: true, slowAudio: true },
  B2: { translation: false, starters: false, wordBank: false, hints: false, slowAudio: false },
}

export const scaffoldingFor = (level: TrainerLevel | undefined): Scaffolding =>
  SCAFFOLDING[level ?? 'A1'] ?? SCAFFOLDING.A1
