import { apiRequest } from '../course-map/data/client.ts'
import { checked } from '../course-map/data/contract.ts'
import { parseCatalog } from './catalogContract.ts'
import type {
  AnswerResult,
  Catalog,
  SessionStart,
  SessionSummary,
  StepResponse,
  TrainerProgress,
  Vocabulary,
} from './types.ts'

// The practice endpoints of contract v2. A practice answer carries a client-made
// attempt_id so a repeat returns the original response.
const BASE = '/trainer'

export const trainerApi = {
  // Checked at the edge: a catalog the screens cannot read is a ContractError here,
  // not a TypeError in a component.
  catalog: async (): Promise<Catalog> =>
    checked('GET /trainer/catalog', parseCatalog)(await apiRequest<unknown>(`${BASE}/catalog`)),
  start: (activityId: string) =>
    apiRequest<SessionStart>(`${BASE}/sessions`, {
      method: 'POST',
      body: { activity_id: activityId },
    }),
  answer: (
    sessionId: string,
    body: { attempt_id: string; step_id: string; response: StepResponse }
  ) => apiRequest<AnswerResult>(`${BASE}/sessions/${sessionId}/answers`, { method: 'POST', body }),
  finish: (sessionId: string) =>
    apiRequest<SessionSummary>(`${BASE}/sessions/${sessionId}/finish`, { method: 'POST' }),
  vocabulary: () => apiRequest<Vocabulary>(`${BASE}/vocabulary`),
  saveWord: (wordId: string) => apiRequest<void>(`${BASE}/vocabulary/${wordId}`, { method: 'PUT' }),
  removeWord: (wordId: string) =>
    apiRequest<void>(`${BASE}/vocabulary/${wordId}`, { method: 'DELETE' }),
  review: (wordId: string, body: { attempt_id: string; knew: boolean }) =>
    apiRequest<{ box: number; due_at: string }>(`${BASE}/vocabulary/${wordId}/review`, {
      method: 'POST',
      body,
    }),
  progress: () => apiRequest<TrainerProgress>(`${BASE}/progress`),
  deleteMine: () => apiRequest<void>(`${BASE}/me`, { method: 'DELETE' }),
}
