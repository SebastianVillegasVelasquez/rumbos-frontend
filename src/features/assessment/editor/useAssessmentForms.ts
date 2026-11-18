import { useQuery } from '@tanstack/react-query'
import { assessmentApi } from '../api.ts'
import type { FormsState } from './forms.ts'

// The forms the author can pick. When the list cannot be had, the picker says so and
// offers nothing: there is no form to fall back to.
export const useAssessmentForms = (): FormsState => {
  const query = useQuery({
    queryKey: ['trainer', 'assessment-forms'],
    queryFn: assessmentApi.forms,
    retry: false,
    staleTime: 60_000,
  })
  return { forms: query.data ?? [], loading: query.isPending, failed: query.isError }
}
