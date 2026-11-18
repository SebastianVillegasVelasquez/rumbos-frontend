// The evaluation forms an author can pick. The backend's OpenAPI has no route that lists
// them (there was never a GET /trainer/assessments/forms: it answered 404), so the list is
// the one form known to exist. A form the author types that the backend does not know is
// refused on save (`form_not_found`). When the backend publishes a list, it replaces this.
// Nothing here chooses one for the author: a selection is required.

export interface AssessmentForm {
  id: string
  title: string
}

export const KNOWN_FORMS: readonly AssessmentForm[] = [{ id: 'a1-form-a', title: 'a1-form-a' }]
