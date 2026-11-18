// Contract v2, practice side (/api/v1/trainer). Wire names stay snake_case.

export type Skill = 'dialogue' | 'listening' | 'grammar' | 'writing' | 'vocabulary'
export type TrainerLevel = 'A1' | 'A2' | 'B1' | 'B2'

// The catalog as GET /trainer/catalog sends it (openapi.json: Catalog, CatalogModule,
// CatalogLesson, CatalogActivity). Nothing here is the front's own invention: a field the
// backend does not send (locked, completed_count, best_score) is not in these types.
export type PublicationState = 'draft' | 'reviewed' | 'published'
export type ActivityState = 'not_started' | 'in_progress' | 'finished'

export interface CatalogActivity {
  id: string
  skill: Skill
  title: string
  estimated_minutes: number
  step_count: number
  role: string | null
  can_do: string[]
  // Editors in preview get draft and reviewed too; students, published only.
  publication_state: PublicationState
  state: ActivityState
  best_percent: number | null
}

export interface CatalogLesson {
  id: string
  code: string
  title: string
  description: string
  vocabulary_count: number
  activities: CatalogActivity[]
}

export interface CatalogModule {
  key: string
  title: string
  lessons: CatalogLesson[]
}

// Why a catalog has nothing to offer (additive field; a backend that predates it
// sends `enabled: false` alone).
export type CatalogReason = 'disabled_for_map' | 'no_published_content'

export interface Catalog {
  enabled: boolean
  reason?: CatalogReason
  title?: string
  language?: { code: string; name: string }
  level?: TrainerLevel
  content_version?: string
  // Whether the caller is an editor in preview (required by Catalog and CatalogUnavailable).
  preview: boolean
  modules?: CatalogModule[]
  skills?: { skill: Skill; available: boolean }[]
  suggestion?: { activity_id: string; reason: 'next' | 'review' } | null
  vocab_due?: number
}

export interface ActivityInfo {
  id: string
  title: string
  skill: Skill
  lesson_id: string
  role: string | null
  can_do: string[]
  step_count: number
}

export interface StepAudio {
  url: string
  duration_s: number
  transcript: string
}

interface StepBase {
  step_id: string
  prompt: string
  hint: string | null
  audio: StepAudio | null
}

export interface Option {
  option_id: string
  text: string
}

export type Step = StepBase &
  (
    | { type: 'mcq' | 'listen_choose'; options: Option[] }
    | {
        type: 'gap_fill'
        template: string
        gaps: { gap_id: string; options: Option[] | null }[]
      }
    | { type: 'reorder'; tokens: { token_id: string; text: string }[] }
    | {
        type: 'match'
        left: { id: string; text: string }[]
        right: { id: string; text: string }[]
      }
    | { type: 'short_answer'; max_length: number }
    | {
        type: 'dialogue_turn'
        partner_line: {
          text: string
          translation: string | null
          audio: StepAudio | null
        }
        mode: 'choose' | 'type'
        options: Option[] | null
        starters: string[]
        word_bank: string[]
      }
  )

export type StepType = Step['type']

export type StepResponse =
  | { option_id: string }
  | { values: Record<string, string> }
  | { token_ids: string[] }
  | { pairs: [string, string][] }
  | { text: string }

export interface Progress {
  index: number
  total: number
}

export interface SessionStart {
  session_id: string
  preview: boolean
  step: Step
  progress: Progress
}

export type Outcome = 'correct' | 'partial' | 'incorrect' | 'accepted'

export interface AnswerResult {
  outcome: Outcome
  feedback: {
    explanation: string | null
    closest_answer: string | null
    error_tags: { tag: string; text: string }[]
  }
  next_step: Step | null
  progress: Progress
}

export interface SessionSummary {
  score: { correct: number; total: number }
  went_well: string[]
  to_improve: { tag: string; text: string; example: string | null }[]
  new_vocabulary: { word_id: string; word: string; translation: string }[]
  can_do: string[]
  next_activity_id: string | null
}

export interface SavedWord {
  word_id: string
  word: string
  translation: string
  box: number
  due_at: string
}

export interface Vocabulary {
  saved: SavedWord[]
  due_count: number
}

export interface TrainerProgress {
  by_skill: { skill: Skill; completed: number; goal: number }[]
  recent: { activity_id: string; title: string; skill: Skill; finished_at: string; score: number }[]
}
