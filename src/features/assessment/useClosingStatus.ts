import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '../course-map/data/client.ts'
import { checked } from '../course-map/data/contract.ts'
import { parseClosingStatus } from './closingStatus.ts'

// GET /trainer/closing: the backend's word on the closing flow and the student's journey. One
// query key, so the HUD, the cards and the screens read the same answer, and an exam that
// finishes only has to invalidate it.
export const CLOSING_STATUS_KEY = ['trainer', 'closing'] as const

export const closingApi = {
  status: async () =>
    checked(
      'GET /trainer/closing',
      parseClosingStatus
    )(await apiRequest<unknown>('/trainer/closing')),
}

export const useClosingStatus = (enabled: boolean) =>
  useQuery({
    queryKey: CLOSING_STATUS_KEY,
    queryFn: closingApi.status,
    retry: 1,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    enabled,
  })
