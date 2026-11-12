import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import {
  clearHostFlow,
  getHostQuizReceivedCount,
  setHostFlowProgress,
  setHostQuizResult,
} from './hostFlow.ts'

afterEach(() => clearHostFlow())

// The quiz step decides "the host never answers" by comparing this count before
// and after its asks. The host also answers every progress write, which says
// nothing about quiz requests, so only quiz answers may move it.
describe('the count of quiz answers', () => {
  it('does not move for progress answers', () => {
    const before = getHostQuizReceivedCount()
    setHostFlowProgress({
      type: 'rumbos:host-flow-progress',
      v: 1,
      mapId: 'm',
      items: [],
      persistent: true,
      config: { quizThreshold: 70 },
    })
    setHostFlowProgress({ type: 'rumbos:host-flow-progress', v: 1, mapId: 'm', error: 'readonly' })
    assert.equal(getHostQuizReceivedCount(), before)
  })

  it('moves for every quiz answer, results and errors alike', () => {
    const before = getHostQuizReceivedCount()
    setHostQuizResult({ type: 'rumbos:host-quiz-result', v: 1, cmid: 101, error: 'not_found' })
    setHostQuizResult({
      type: 'rumbos:host-quiz-result',
      v: 1,
      cmid: 101,
      result: {
        attempts: 1,
        finishedAttempts: 1,
        inProgress: false,
        percent: 85,
        pendingGrading: false,
        passedThreshold: true,
      },
    })
    assert.equal(getHostQuizReceivedCount(), before + 2)
  })
})
