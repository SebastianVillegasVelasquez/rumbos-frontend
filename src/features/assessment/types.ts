// The assessment half of the trainer API, contract v2 (`/api/v1/trainer`). Field
// names stay as the wire has them (snake_case): there is no translation layer to
// get wrong. Hand-written until the backend publishes its OpenAPI; the contract
// test then checks these against it.

export type AssessmentPurpose = 'check_in' | 'final'
export type PassOperator = 'gt' | 'gte'
export type AssessmentState = 'available' | 'in_progress' | 'exhausted' | 'locked' | 'passed'
export type Band = 'emerging' | 'developing' | 'consolidating' | 'achieved'
export type SyncState = 'not_required' | 'pending' | 'synced' | 'failed'

export interface AssessmentPolicy {
  pass_percent: number
  pass_operator: PassOperator
  time_limit_min: number
}

export interface AssessmentListItem {
  purpose: AssessmentPurpose
  title: string
  section_count: number
  item_count: number
  attempts: { used: number; max: number }
  state: AssessmentState
  locked_reason: string | null
  in_progress: { attempt_id: string; deadline_at: string } | null
  best: { percent: string; passed: boolean; finished_at: string } | null
}

export interface EnabledAssessmentList {
  enabled: true
  preview: boolean
  policy: AssessmentPolicy
  items: AssessmentListItem[]
}

// A map without assessments answers `enabled: false` and nothing else: no policy, no
// items. The client makes `items` an empty list so a reader never meets `undefined`.
export interface DisabledAssessmentList {
  enabled: false
  preview: boolean
  items: []
}

export type AssessmentList = EnabledAssessmentList | DisabledAssessmentList

export interface SectionSummary {
  key: string
  title: string
  instructions: string
  item_count: number
}

export interface AttemptStart {
  attempt_id: string
  started_at: string
  deadline_at: string
  server_now: string
  sections: SectionSummary[]
}

export interface ItemOption {
  option_id: string
  text: string
}

export interface AudioRef {
  url: string
  duration_s: number
  // Practice may show it; the exam never does.
  transcript?: string | null
}

interface ItemBase {
  item_id: string
  prompt: string
}

export interface McqItem extends ItemBase {
  type: 'mcq'
  options: ItemOption[]
}
export interface ListenChooseItem extends ItemBase {
  type: 'listen_choose'
  audio: AudioRef
  options: ItemOption[]
}
export interface GapChoiceItem extends ItemBase {
  type: 'gap_choice'
  gap_label: string
  options: ItemOption[]
}
export interface MatchAudioItem extends ItemBase {
  type: 'match_audio'
  clips: { id: string; audio: AudioRef }[]
  places: { id: string; text: string }[]
}
export interface FormFieldsItem extends ItemBase {
  type: 'form_fields'
  fields: { field_id: string; label: string }[]
}
export interface TemplateTextItem extends ItemBase {
  type: 'template_text'
  template: string
  min_words: number
  max_words: number
}
export interface WrittenAnswersItem extends ItemBase {
  type: 'written_answers'
  questions: { q_id: string; prompt: string }[]
  // Length hints for the UI, declared only when the form sets them (B2 Writing: 120, 160,
  // 1500). The server enforces the character limit; these only keep the student informed.
  min_words?: number
  max_words?: number
  max_chars?: number
}

export type AssessmentItem =
  | McqItem
  | ListenChooseItem
  | GapChoiceItem
  | MatchAudioItem
  | FormFieldsItem
  | TemplateTextItem
  | WrittenAnswersItem

// What the student answered, per item type. Sent and saved exactly like this.
export type ItemResponse =
  { option_id: string } | { pairs: [string, string][] } | { values: Record<string, string> }

export interface SharedContent {
  text?: string
  passage?: string
  image?: { url: string; alt: string }
  audio?: AudioRef
  sign?: string
}

export interface SectionPart {
  part_key: string
  instructions: string
  shared: SharedContent | null
  items: AssessmentItem[]
}

export interface SectionPayload {
  key: string
  title: string
  deadline_at: string
  server_now: string
  parts: SectionPart[]
  saved: Record<string, ItemResponse>
}

export interface SaveAck {
  saved_at: string
  server_now: string
  deadline_at: string
}

export interface SectionResult {
  key: string
  points: number
  max: number
  percent: string
  weight: number
}

export interface AssessmentResult {
  status: 'submitted' | 'expired'
  // A decimal string with two decimals, never a float.
  percent: string
  passed: boolean
  band: Band
  by_section: SectionResult[]
  by_module: { module: string; percent: string }[]
  attempts: { used: number; max: number }
  gain: string | null
  sync: { state: SyncState }
}

// Section order of Forma A, as the document has it.
export const SECTION_ORDER = [
  'listening',
  'reading',
  'use_of_english',
  'writing',
  'speaking',
] as const
