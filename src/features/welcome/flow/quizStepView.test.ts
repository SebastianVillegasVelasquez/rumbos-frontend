import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { es } from '../../../i18n/es.ts'
import type { QuizResult } from '../../embed/protocol.ts'
import type { QuizGate } from './flowReducer.ts'
import { checkinReducer, createCheckin, type CheckinEvent } from './quizCheckin.ts'
import { agoText, quizStepView } from './quizStepView.ts'

const text = es.flow.quiz
const none: QuizResult = {
  attempts: 0,
  finishedAttempts: 0,
  inProgress: false,
  percent: null,
  pendingGrading: false,
  passedThreshold: null,
}
const gateOf = (patch: Partial<QuizResult> = {}): QuizGate => ({
  kind: 'result',
  result: { ...none, ...patch },
})
const T0 = 1_000_000
const checkin = (...events: CheckinEvent[]) => events.reduce(checkinReducer, createCheckin(T0))
const view = (gate: QuizGate, state = checkin(), editor = false) =>
  quizStepView({ gate, checkin: state, editor })

describe('the message for each state of the check-in', () => {
  it('says what to do for no attempt, an open attempt and an unknown answer', () => {
    assert.equal(view(gateOf({ reason: 'no_attempts' })).message, 'not_started')
    assert.equal(
      view(gateOf({ reason: 'in_progress', inProgress: true, attempts: 1 })).message,
      'in_progress'
    )
    assert.equal(view(gateOf()).message, 'waiting')
  })

  it('offers "Continuar el intento" only with an attempt open', () => {
    assert.equal(view(gateOf({ inProgress: true, attempts: 1 })).openLabel, text.resume)
    assert.equal(view(gateOf()).openLabel, text.start)
    assert.equal(text.start, 'Abrir cuestionario')
  })

  it('says a non-student account is not recorded, and a pending grade', () => {
    assert.equal(
      view(gateOf({ reason: 'preview_only', previewAttempts: 1 })).message,
      'non_student'
    )
    assert.equal(view(gateOf({ reason: 'not_graded_yet' })).message, 'not_graded')
    assert.match(text.nonStudent, /no es de estudiante/)
  })

  it('has no message before the first answer', () => {
    assert.equal(view({ kind: 'pending' }).message, null)
  })
})

describe('"Comprobar de nuevo" always visibly does something', () => {
  it('is enabled and idle by default', () => {
    const v = view(gateOf())
    assert.equal(v.checkLabel, text.checkAgain)
    assert.equal(v.checkDisabled, false)
    assert.equal(v.checking, false)
  })

  it('is disabled and reads "Comprobando…" only while a request is pending', () => {
    const v = view(gateOf(), checkin({ type: 'check-start', at: T0 }))
    assert.equal(v.checkDisabled, true)
    assert.equal(v.checking, true)
    assert.equal(v.checkLabel, 'Comprobando…')
  })

  it('shows the outcome with its time, also when the answer did not change', () => {
    const state = checkin(
      { type: 'check-start', at: T0 },
      { type: 'answer', at: T0 + 300, result: none },
      { type: 'check-start', at: T0 + 20_000 },
      { type: 'answer', at: T0 + 20_300, result: none },
      { type: 'tick', at: T0 + 25_000 }
    )
    const v = view(gateOf(), state)
    assert.equal(v.statusLine, 'Última comprobación: hace unos segundos: 0 intentos finalizados')
    assert.equal(v.checkDisabled, false)
  })

  it('counts attempts in the line, with an open one and the previews', () => {
    const open: QuizResult = { ...none, attempts: 2, finishedAttempts: 1, inProgress: true }
    const state = checkin(
      { type: 'check-start', at: T0 },
      { type: 'answer', at: T0 + 100, result: { ...open, previewAttempts: 2 } }
    )
    assert.equal(
      view({ kind: 'result', result: open }, state).statusLine,
      'Última comprobación: hace unos segundos: 1 intento finalizado, un intento sin enviar, 2 intentos de vista previa'
    )
  })

  it('says when Moodle did not answer, and is enabled again', () => {
    const state = checkin({ type: 'check-start', at: T0 }, { type: 'timeout', at: T0 + 5_000 })
    const v = view(gateOf(), state)
    assert.equal(v.statusLine, text.timeout)
    assert.equal(v.checkDisabled, false)
  })

  it('says an error reply, with the time', () => {
    const state = checkin({ type: 'check-start', at: T0 }, { type: 'error', at: T0 + 200 })
    assert.match(view(gateOf(), state).statusLine ?? '', /no pudimos consultar Moodle/)
  })

  it('ages the time as the clock moves', () => {
    assert.equal(agoText(0), 'hace unos segundos')
    assert.equal(agoText(59_999), 'hace unos segundos')
    assert.equal(agoText(60_000), 'hace 1 min')
    assert.equal(agoText(5 * 60_000 + 10), 'hace 5 min')
  })
})

describe('the exit on screen', () => {
  const opened = { type: 'opened', at: T0 } as const

  it('is hidden at first, and after one failed check', () => {
    assert.equal(view(gateOf()).escape, false)
    const one = checkin(
      opened,
      { type: 'check-start', at: T0 + 1_000 },
      {
        type: 'answer',
        at: T0 + 1_200,
        result: none,
      }
    )
    assert.equal(view(gateOf(), one).escape, false)
  })

  it('shows after two failed checks in a row once the quiz was opened', () => {
    const two = checkin(
      opened,
      { type: 'check-start', at: T0 + 1_000 },
      { type: 'answer', at: T0 + 1_200, result: none },
      { type: 'check-start', at: T0 + 6_000 },
      { type: 'answer', at: T0 + 6_200, result: none }
    )
    assert.equal(view(gateOf(), two).escape, true)
  })

  it('shows after 45 s with the quiz opened', () => {
    assert.equal(view(gateOf(), checkin(opened, { type: 'tick', at: T0 + 45_000 })).escape, true)
  })

  it('shows after a missing reply, and after an error', () => {
    const missing = checkin({ type: 'check-start', at: T0 }, { type: 'timeout', at: T0 + 5_000 })
    assert.equal(view(gateOf(), missing).escape, true)
  })

  it('is never offered to a result that already lets the viewer go, or to an editor', () => {
    const late = checkin(opened, { type: 'tick', at: T0 + 60_000 })
    assert.equal(view(gateOf({ attempts: 1, finishedAttempts: 1 }), late).escape, false)
    assert.equal(view(gateOf({ reason: 'preview_only' }), late).escape, false)
    assert.equal(view(gateOf(), late, true).escape, false)
    assert.equal(view(gateOf(), late, true).editorNote, true)
  })
})
