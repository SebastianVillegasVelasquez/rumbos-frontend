import { apiRequest } from '../course-map/data/client.ts'
import type {
  ActivityInfo,
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
  catalog: () => apiRequest<Catalog>(`${BASE}/catalog`),
  activity: (id: string) => apiRequest<ActivityInfo>(`${BASE}/activities/${id}`),
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
