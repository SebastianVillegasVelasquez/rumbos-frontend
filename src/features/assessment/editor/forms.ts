// The evaluation forms an author can pick. The backend is adding a read-only list;
// until it answers, `a1-form-a` is the only form there is. Nothing here chooses one
// for the author: a selection is required.

export interface AssessmentForm {
  id: string
  title: string
}

// ASSUMPTION: the list endpoint (not yet in this repo's contract copy).
export const FORMS_PATH = '/trainer/assessments/forms'

export const FALLBACK_FORMS: readonly AssessmentForm[] = [{ id: 'a1-form-a', title: 'a1-form-a' }]

const asForm = (value: unknown): AssessmentForm | null => {
  if (typeof value === 'string' && value !== '') return { id: value, title: value }
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const id =
    typeof raw.form_id === 'string' ? raw.form_id : typeof raw.id === 'string' ? raw.id : ''
  if (id === '') return null
  const title =
    typeof raw.title === 'string' && raw.title !== ''
      ? raw.title
      : typeof raw.name === 'string' && raw.name !== ''
        ? raw.name
        : id
  return { id, title }
}

// Accepts a bare array or { items } / { forms }. An empty or unreadable answer is
// the same as no list: the fallback applies.
export const parseForms = (body: unknown): AssessmentForm[] => {
  const list = Array.isArray(body)
    ? body
    : body && typeof body === 'object'
      ? ((body as { items?: unknown; forms?: unknown }).items ??
        (body as { forms?: unknown }).forms)
      : null
  const forms = Array.isArray(list)
    ? list.map(asForm).filter((form): form is AssessmentForm => form !== null)
    : []
  return forms.length > 0 ? forms : [...FALLBACK_FORMS]
}
