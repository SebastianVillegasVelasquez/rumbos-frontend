import { apiRequest } from '../course-map/data/client.ts'
import { checked } from '../course-map/data/contract.ts'
import { parseCatalog } from './catalogContract.ts'
import { readAnswer, readSession, readSummary, type SessionCursor } from './sessionWire.ts'
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

// The steps of each session this page opened: an exercise arrives whole and the screens
// walk it, so an answer needs to know what comes after the step answered.
const cursors = new Map<string, SessionCursor>()

export const trainerApi = {
  // Checked at the edge: a catalog the screens cannot read is a ContractError here,
  // not a TypeError in a component.
  catalog: async (): Promise<Catalog> =>
    checked('GET /trainer/catalog', parseCatalog)(await apiRequest<unknown>(`${BASE}/catalog`)),
  // Opens a practice (201) or resumes the one already open (200). The preview flag is the
  // catalog's, not the session's: the caller adds it.
  start: async (activityId: string): Promise<Omit<SessionStart, 'preview'>> => {
    const { start, cursor } = readSession(
      await apiRequest<unknown>(`${BASE}/sessions`, {
        method: 'POST',
        body: { activity_id: activityId },
      }),
      'POST /trainer/sessions'
    )
    cursors.set(start.session_id, cursor)
    return start
  },
  answer: async (
    sessionId: string,
    body: { attempt_id: string; step_id: string; response: StepResponse }
  ): Promise<AnswerResult> => {
    const cursor = cursors.get(sessionId)
    if (!cursor) throw new Error(`No session ${sessionId} was opened by this page`)
    return readAnswer(
      await apiRequest<unknown>(`${BASE}/sessions/${sessionId}/answers`, { method: 'POST', body }),
      cursor,
      body.step_id,
      'POST /trainer/sessions/{session_id}/answers'
    )
  },
  finish: async (sessionId: string): Promise<SessionSummary> =>
    readSummary(
      await apiRequest<unknown>(`${BASE}/sessions/${sessionId}/finish`, { method: 'POST' }),
      'POST /trainer/sessions/{session_id}/finish'
    ),
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
