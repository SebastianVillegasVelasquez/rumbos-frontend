import { useCallback, useEffect, useReducer } from 'react'
import { trainerApi } from './api.ts'
import { classifyFailure } from './failure.ts'
import { initialSession, sessionReducer, type SessionState } from './sessionReducer.ts'
import type { StepResponse } from './types.ts'

// A client-made id for a practice answer: a repeat of the same one returns the
// original response, so a retry after a lost reply never double-counts.
export const newAttemptId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`

// Runs the effects of the pure session reducer: start, answer, finish.
export const useSession = (activityId: string) => {
  const [state, dispatch] = useReducer(sessionReducer, initialSession)

  useEffect(() => {
    if (state.phase !== 'starting') return
    let alive = true
    trainerApi
      .start(activityId)
      .then((start) => alive && dispatch({ type: 'started', start }))
      .catch((error) => alive && dispatch({ type: 'failed', kind: classifyFailure(error) }))
    return () => {
      alive = false
    }
  }, [state.phase, activityId])

  useEffect(() => {
    if (state.phase !== 'checking' || !state.sessionId || !state.step || !state.attemptId) return
    if (!state.draft) return
    let alive = true
    trainerApi
      .answer(state.sessionId, {
        attempt_id: state.attemptId,
        step_id: state.step.step_id,
        response: state.draft,
      })
      .then((result) => alive && dispatch({ type: 'answered', result }))
      .catch((error) => alive && dispatch({ type: 'failed', kind: classifyFailure(error) }))
    return () => {
      alive = false
    }
  }, [state.phase, state.sessionId, state.step, state.attemptId, state.draft])

  useEffect(() => {
    if (state.phase !== 'finishing' || !state.sessionId) return
    let alive = true
    trainerApi
      .finish(state.sessionId)
      .then((summary) => alive && dispatch({ type: 'finished', summary }))
      .catch((error) => alive && dispatch({ type: 'failed', kind: classifyFailure(error) }))
    return () => {
      alive = false
    }
  }, [state.phase, state.sessionId])

  const begin = useCallback(() => dispatch({ type: 'start' }), [])
  const setDraft = useCallback(
    (response: StepResponse | null) => dispatch({ type: 'draft', response }),
    []
  )
  const submit = useCallback(() => dispatch({ type: 'submit', attemptId: newAttemptId() }), [])
  const next = useCallback(() => dispatch({ type: 'next' }), [])
  const finish = useCallback(() => dispatch({ type: 'finish' }), [])
  const retry = useCallback(() => dispatch({ type: 'retry' }), [])

  return { state: state as SessionState, begin, setDraft, submit, next, finish, retry }
}
