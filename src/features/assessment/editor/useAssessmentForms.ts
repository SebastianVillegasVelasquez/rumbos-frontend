import { KNOWN_FORMS, type AssessmentForm } from './forms.ts'

// The forms the author can pick: the known list, with no request (the backend has no
// route for it, see forms.ts). Kept as a hook so the editor does not change when one exists.
export const useAssessmentForms = (): { forms: readonly AssessmentForm[]; loading: boolean } => ({
  forms: KNOWN_FORMS,
  loading: false,
})
