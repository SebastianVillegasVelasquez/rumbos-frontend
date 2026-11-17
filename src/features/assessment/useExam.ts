import { useCallback, useEffect, useReducer, useRef } from 'react'
import { announce } from '../../components/ui/announce.ts'
import { esAssessment } from '../../i18n/assessment.es.ts'
import { assessmentApi } from './api.ts'
import { examReducer, initialExam, isFinished, type ExamState } from './examReducer.ts'
import { classifyFailure } from './failure.ts'
import type { AssessmentPurpose, AssessmentResult, ItemResponse } from './types.ts'

// The runner's effects: the network, the debounce, the clock and the polling. All
// decisions are the pure reducer's; this only does what the state asks and reports
// the outcome back as events.

const SAVE_DEBOUNCE_MS = 700
// The passback poll: a few looks with a growing gap, never forever.
export const SYNC_POLL_DELAYS_MS = [2_000, 4_000, 8_000, 15_000, 30_000] as const

const entries = (map: Record<string, ItemResponse>) =>
  Object.entries(map).map(([item_id, response]) => ({ item_id, response }))

export const useExam = (
  purpose: AssessmentPurpose,
  onFinished?: (result: AssessmentResult) => void
) => {
  const [state, dispatch] = useReducer(examReducer, initialExam)
  const latest = useRef<ExamState>(state)
  useEffect(() => {
    latest.current = state
  }, [state])
  const loading = useRef(new Set<number>())
  const finishedRef = useRef(false)

  const { phase, attemptId, dirty, sectionIndex, sections, sectionError, view } = state

  // Starting or resuming: the server returns the attempt in progress when there is
  // one, so both are the same call.
  useEffect(() => {
    if (phase !== 'starting' && phase !== 'resuming') return
    let cancelled = false
    assessmentApi
      .start(purpose)
      .then((attempt) => !cancelled && dispatch({ type: 'started', attempt, now: Date.now() }))
      .catch(
        (error: unknown) =>
          !cancelled && dispatch({ type: 'failed', kind: classifyFailure(error), retry: 'start' })
      )
    return () => {
      cancelled = true
    }
  }, [phase, purpose])

  // Sections: the one on screen first, then the rest in the background, one at a
  // time, so the payloads stay small. The review needs all of them.
  const live = phase === 'running' || phase === 'saving'
  useEffect(() => {
    if (!live || !attemptId) return
    const missing = sections.findIndex(
      (section, index) => section === null && index !== sectionError
    )
    const target =
      sections[sectionIndex] === null && sectionError !== sectionIndex ? sectionIndex : missing
    if (target < 0 || loading.current.has(target)) return
    loading.current.add(target)
    const key = state.summaries[target].key
    assessmentApi
      .section(attemptId, key)
      .then((payload) =>
        dispatch({ type: 'section-loaded', index: target, payload, now: Date.now() })
      )
      .catch(() => dispatch({ type: 'section-failed', index: target }))
      .finally(() => loading.current.delete(target))
  }, [live, attemptId, sections, sectionIndex, sectionError, state.summaries, view])

  // Autosave: a quiet debounce after the last answer. A failed save is not retried
  // in a loop; the next answer, the button or the connection coming back does it.
  useEffect(() => {
    if (phase !== 'running' || Object.keys(dirty).length === 0 || state.saveStatus === 'failed')
      return
    const timer = setTimeout(() => dispatch({ type: 'save-start' }), SAVE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [phase, dirty, state.saveStatus])

  useEffect(() => {
    if (phase !== 'saving' || !attemptId) return
    let cancelled = false
    assessmentApi
      .save(attemptId, entries(latest.current.inflight))
      .then((ack) => !cancelled && dispatch({ type: 'save-ok', ack, now: Date.now() }))
      .catch(
        (error: unknown) =>
          !cancelled && dispatch({ type: 'save-failed', kind: classifyFailure(error) })
      )
    return () => {
      cancelled = true
    }
  }, [phase, attemptId])

  // A connection that comes back saves what is waiting.
  useEffect(() => {
    const onOnline = () => dispatch({ type: 'save-start' })
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [])

  // The countdown. A hidden tab throttles timers, so coming back ticks at once.
  useEffect(() => {
    if (!live) return
    const tick = () => dispatch({ type: 'tick', now: Date.now() })
    const id = setInterval(tick, 1000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [live])

  // 10, 5 and 1 minutes, once each, through the polite live region.
  useEffect(() => {
    if (state.announcement === null) return
    announce(esAssessment.runner.minutesLeft(state.announcement))
    dispatch({ type: 'announced' })
  }, [state.announcement])

  // Submitting: first what is still unsaved (unless the time is up, when the
  // server refuses writes and keeps what it has), then the submit itself.
  useEffect(() => {
    if (phase !== 'submitting' || !attemptId) return
    let cancelled = false
    ;(async () => {
      try {
        const current = latest.current
        const unsaved = { ...current.inflight, ...current.dirty }
        if (!current.timeUp && Object.keys(unsaved).length > 0) {
          try {
            await assessmentApi.save(attemptId, entries(unsaved))
          } catch (error) {
            // The attempt closed under us: submit to read the result. Anything else
            // stops here, with every answer still on screen.
            if (classifyFailure(error) !== 'closed') throw error
          }
        }
        const result = await assessmentApi.submit(attemptId)
        if (!cancelled) dispatch({ type: 'submitted', result })
      } catch (error) {
        if (!cancelled) dispatch({ type: 'failed', kind: classifyFailure(error), retry: 'submit' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [phase, attemptId])

  // After a pass the backend tells the truth about the passback: look a few times.
  const syncState = state.result?.sync.state
  useEffect(() => {
    if (!attemptId || !isFinished(phase) || syncState !== 'pending') return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const look = (n: number) => {
      if (n >= SYNC_POLL_DELAYS_MS.length) return
      timer = setTimeout(() => {
        assessmentApi
          .result(attemptId)
          .then((result) => {
            if (cancelled) return
            dispatch({ type: 'result-updated', result })
            if (result.sync.state === 'pending') look(n + 1)
          })
          .catch(() => !cancelled && look(n + 1))
      }, SYNC_POLL_DELAYS_MS[n])
    }
    look(0)
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [attemptId, phase, syncState])

  useEffect(() => {
    if (!isFinished(phase) || !state.result || finishedRef.current) return
    finishedRef.current = true
    onFinished?.(state.result)
  }, [phase, state.result, onFinished])

  const start = useCallback(
    (resume: boolean) => dispatch({ type: 'start', purpose, resume }),
    [purpose]
  )
  return {
    state,
    start,
    answer: useCallback(
      (itemId: string, response: ItemResponse) => dispatch({ type: 'answer', itemId, response }),
      []
    ),
    gotoSection: useCallback((index: number) => dispatch({ type: 'goto-section', index }), []),
    openReview: useCallback(() => dispatch({ type: 'open-review' }), []),
    closeReview: useCallback(() => dispatch({ type: 'close-review' }), []),
    submit: useCallback(() => dispatch({ type: 'submit' }), []),
    retry: useCallback(() => dispatch({ type: 'retry', now: Date.now() }), []),
    retrySave: useCallback(() => dispatch({ type: 'save-start' }), []),
    retrySection: useCallback(() => dispatch({ type: 'section-retry' }), []),
  }
}
