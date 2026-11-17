import { apiRequest } from '../course-map/data/client.ts'
import { refuseLeak } from './leakGuard.ts'
import type {
  AssessmentList,
  AssessmentPurpose,
  AssessmentResult,
  AttemptStart,
  ItemResponse,
  SaveAck,
  SectionPayload,
} from './types.ts'

// The assessment endpoints of contract v2. Every answer passes the leak guard:
// a response that carries a key or a correctness field is refused whole, so it
// is never stored in state, a cache or the DOM.
const BASE = '/trainer'

const get = async <T>(path: string): Promise<T> => refuseLeak(await apiRequest<T>(`${BASE}${path}`))

export const assessmentApi = {
  list: () => get<AssessmentList>('/assessments'),

  // 201 on a new attempt, 200 when one is resumed: the caller needs no difference.
  start: async (purpose: AssessmentPurpose) =>
    refuseLeak(
      await apiRequest<AttemptStart>(`${BASE}/assessments/${purpose}/attempts`, { method: 'POST' })
    ),

  section: (attemptId: string, key: string) =>
    get<SectionPayload>(`/attempts/${attemptId}/sections/${key}`),

  save: async (attemptId: string, answers: { item_id: string; response: ItemResponse }[]) =>
    refuseLeak(
      await apiRequest<SaveAck>(`${BASE}/attempts/${attemptId}/answers`, {
        method: 'PUT',
        body: { answers },
      })
    ),

  submit: async (attemptId: string) =>
    refuseLeak(
      await apiRequest<AssessmentResult>(`${BASE}/attempts/${attemptId}/submit`, { method: 'POST' })
    ),

  result: (attemptId: string) => get<AssessmentResult>(`/attempts/${attemptId}/result`),
}

export type ReportReason = 'wrong_answer' | 'unclear' | 'audio' | 'offensive' | 'other'
export const REPORT_NOTE_MAX = 500

// "Reportar un error" (practice step, or the whole exam from its result screen).
export const sendReport = (report: {
  activity_id: string | null
  step_id: string | null
  item_id: string | null
  reason: ReportReason
  note: string | null
}): Promise<void> => apiRequest<void>(`${BASE}/reports`, { method: 'POST', body: report })
