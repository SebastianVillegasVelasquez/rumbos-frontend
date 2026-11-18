import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '../../course-map/data/client.ts'
import { FALLBACK_FORMS, FORMS_PATH, parseForms, type AssessmentForm } from './forms.ts'

// The forms the author can pick. A backend without the list (404) or an unreachable
// one leaves the known form, so the editor is never stuck without a choice.
export const useAssessmentForms = (): { forms: readonly AssessmentForm[]; loading: boolean } => {
  const query = useQuery({
    queryKey: ['trainer', 'assessment-forms'],
    queryFn: async () => parseForms(await apiRequest<unknown>(FORMS_PATH)),
    retry: false,
    staleTime: 60_000,
  })
  return { forms: query.data ?? FALLBACK_FORMS, loading: query.isPending }
}
