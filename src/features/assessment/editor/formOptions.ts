import { es } from '../../../i18n/es.ts'
import type { AssessmentForm, FormPurpose } from './forms.ts'

const text = es.studio.training

// How the picker lists the exam forms. Pure, so the rules are tested.
//
// Proposal (the author decides): when the course trains a level, forms of that level come
// first and forms of other levels stay choosable under their own heading, marked with their
// level; the server refuses a mismatch on save (422 form_level_mismatch) and says so in
// words. With the trainer off the level is only a default, so nothing is grouped.

const LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const levelRank = (level: string | undefined) => {
  const index = level === undefined ? -1 : LEVEL_ORDER.indexOf(level)
  return index === -1 ? LEVEL_ORDER.length : index
}

const PURPOSE_LABEL: Record<FormPurpose, string> = {
  check_in: text.checkIn,
  final: text.final,
}

// By language, then level, then title, then id: stable whatever order the API used.
export const sortForms = (forms: readonly AssessmentForm[]): AssessmentForm[] =>
  [...forms].sort(
    (a, b) =>
      (a.language ?? '').localeCompare(b.language ?? '') ||
      levelRank(a.level) - levelRank(b.level) ||
      a.title.localeCompare(b.title) ||
      a.id.localeCompare(b.id)
  )

// The visible text of an option, which is also its accessible name.
export const formOptionLabel = (form: AssessmentForm): string => {
  const base = text.formOption(
    form.level ?? null,
    form.purpose ? PURPOSE_LABEL[form.purpose] : null,
    form.title
  )
  return form.publication_state === 'published'
    ? base
    : text.formUnpublished(base, form.publication_state)
}

export interface FormGroups {
  // Forms of the course's level (or all of them when the level is not enforced).
  matching: AssessmentForm[]
  // Forms of another language or level; only when the level is enforced.
  others: AssessmentForm[]
}

// `course` is the course's language and level when the trainer is on, null otherwise. A form
// without them (an older backend) never counts as another level.
export const groupForms = (
  forms: readonly AssessmentForm[],
  course: { language: string; level: string } | null
): FormGroups => {
  const sorted = sortForms(forms)
  if (course === null) return { matching: sorted, others: [] }
  const other = (form: AssessmentForm) =>
    (form.level !== undefined && form.level !== course.level) ||
    (form.language !== undefined && form.language !== course.language)
  return { matching: sorted.filter((form) => !other(form)), others: sorted.filter(other) }
}
