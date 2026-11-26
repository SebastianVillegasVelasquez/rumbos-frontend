import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { validated } from '../../contracts/openapiExample.ts'
import type { WelcomeStep } from '../course-map/data/types.ts'
import type { ProgressEntry } from '../welcome/flow/flowReducer.ts'
import { closingStepsFor } from './closingJourney.ts'
import {
  closingFlowStateOf,
  closingPlaceOf,
  entriesAfterFinish,
  entriesToOpenWith,
  type ClosingPlace,
} from './closingResume.ts'
import { parseClosingStatus, type ClosingStatus } from './closingStatus.ts'
import type { JourneyScreen } from './journeyScreens.ts'

// Where a student is on every load: one test per row of the states table (docs/WELCOME-FLOW.md).
// Every status is checked against contracts/openapi.json.

const status = (
  final: string,
  { available = false, reason = null as string | null, checkin = 'not_passed' } = {}
): ClosingStatus =>
  parseClosingStatus(
    validated('GET', '/trainer/closing', 200, {
      enforced: true,
      preview: false,
      available,
      reason,
      progress: { completed: 5, total: 5 },
      final: null,
      outcome: {
        checkin: {
          status: checkin,
          percent: '85.5',
          pass_percent: 70,
          pass_operator: 'gt',
          attempts: { used: 1, max: 2 },
        },
        final: { status: final, reason, attempts: { used: 0, max: 3 } },
        scorm_gate: { satisfied: true, reason: null },
      },
    })
  )

const ready = status('required', { available: true })
// What the backend answers for a passed check-in: the final is not startable (`already_passed`).
const passedCheckin = status('not_required_passed_checkin', {
  reason: 'already_passed',
  checkin: 'passed',
})

const step = (key: string, extra: object = {}): WelcomeStep =>
  ({
    key,
    title: key,
    mandatory: true,
    revision: 1,
    type: 'html',
    html: '<p>x</p>',
    css: null,
    ack: null,
    minSeconds: 0,
    ...extra,
  }) as WelcomeStep
const finalStep = {
  key: 'final0001',
  title: 'Evaluación final',
  mandatory: true,
  revision: 1,
  type: 'assessment',
  purpose: 'final',
} as WelcomeStep
const steps = [step('first0001'), finalStep]

const done = (stepKey: string, revision = 1): ProgressEntry => ({
  stepKey,
  revision,
  method: 'completed',
})

// What a student sees on a fresh load: the status, what Moodle holds, and the screens dismissed.
const load = (
  value: ClosingStatus | null,
  moodle: ProgressEntry[] | null,
  seen: JourneyScreen[] = [],
  flow: WelcomeStep[] = steps
): ClosingPlace =>
  closingPlaceOf({
    status: value,
    flow: closingFlowStateOf(closingStepsFor(flow, value), moodle),
    seen: (screen) => seen.includes(screen),
  })

const NONE: ClosingPlace = { kind: 'none' }
const CARD: ClosingPlace = { kind: 'card' }
const RESUME: ClosingPlace = { kind: 'resume' }
const screen = (name: JourneyScreen): ClosingPlace => ({ kind: 'screen', screen: name })

describe('where the student is on every load', () => {
  it('content done, closing not started: the card, never the flow by itself', () => {
    assert.deepEqual(load(ready, []), CARD)
  })
  it('the browser closed right after the last activity: the card on the next load', () => {
    // Nothing was kept in the browser and Moodle has only the welcome flow's steps.
    assert.deepEqual(load(ready, [done('welcome01')]), CARD)
  })
  it('closing in progress: resumed', () => {
    assert.deepEqual(load(ready, [done('first0001')]), RESUME)
    const longer = [step('first0001'), step('second001'), finalStep]
    assert.deepEqual(load(passedCheckin, [done('first0001')], [], longer), RESUME)
  })
  it('check-in passed, congratulations not seen: shown', () => {
    assert.deepEqual(load(passedCheckin, []), screen('congrats_checkin'))
  })
  it('check-in passed, congratulations seen, closing not started: the card, no dead end', () => {
    assert.deepEqual(load(passedCheckin, [], ['congrats_checkin']), CARD)
  })
  it('final passed: its congratulations once, then the map with no closing prompt', () => {
    const passed = status('passed', { reason: 'already_passed' })
    assert.deepEqual(load(passed, []), screen('congrats_final'))
    assert.deepEqual(load(passed, [done('first0001')], ['congrats_final']), NONE)
  })
  it('closing finished: the map with no closing prompt', () => {
    // Even where this browser never saw the congratulations (another device).
    assert.deepEqual(load(passedCheckin, [done('first0001')]), NONE)
  })
  it('final required, "Terminar" after a failed attempt: the card, to try again', () => {
    assert.deepEqual(load(ready, [done('first0001'), done('final0001')]), CARD)
  })
  it('final attempts spent: the review screen, also with the closing half done', () => {
    const spent = status('exhausted', { reason: 'no_attempts_left' })
    assert.deepEqual(load(spent, [done('first0001')]), screen('exhausted'))
    assert.deepEqual(load(spent, [], ['exhausted']), NONE)
  })
  it('closing unavailable: no prompt at all', () => {
    for (const reason of [
      'scorm_incomplete',
      'progress_unavailable',
      'user_unlinked',
      'not_enabled',
      'no_final_step',
      'form_unavailable',
    ])
      for (const moodle of [[], [done('first0001')]])
        assert.deepEqual(load(status('locked', { reason }), moodle), NONE, reason)
  })
  it('no answer, or no journey (gate off): no prompt', () => {
    assert.deepEqual(load(null, []), NONE)
    assert.deepEqual(
      load(
        parseClosingStatus(
          validated('GET', '/trainer/closing', 200, {
            enforced: false,
            preview: false,
            available: true,
          })
        ),
        []
      ),
      NONE
    )
  })
  it('while Moodle has not answered: nothing, so no screen flashes and goes', () => {
    assert.deepEqual(load(ready, null), NONE)
    assert.deepEqual(load(passedCheckin, null), NONE)
    assert.deepEqual(load(status('exhausted'), null), screen('exhausted'))
  })
})

describe('the closing flow as Moodle has it', () => {
  it('ignores the welcome flow’s records', () => {
    assert.equal(closingFlowStateOf(steps, [done('welcome01')]), 'not_started')
  })
  it('reads a step asked again (a raised revision) as pending', () => {
    const asked = [step('first0001', { revision: 2 }), finalStep]
    assert.equal(
      closingFlowStateOf(asked, [done('first0001', 1), done('final0001')]),
      'in_progress'
    )
  })
  it('is finished without the final step for a passed check-in', () => {
    assert.equal(
      closingFlowStateOf(closingStepsFor(steps, passedCheckin), [done('first0001')]),
      'finished'
    )
  })
})

describe('what the flow opens with', () => {
  const all = [done('first0001'), done('final0001')]
  it('starts on the final exam when it must be taken again', () => {
    assert.deepEqual(entriesToOpenWith(ready, steps, all), [done('first0001')])
  })
  it('keeps what Moodle has otherwise', () => {
    assert.deepEqual(entriesToOpenWith(ready, steps, [done('final0001')]), [done('final0001')])
    assert.deepEqual(entriesToOpenWith(passedCheckin, [steps[0]!], all), all)
  })
})

describe('what is known once the flow closes', () => {
  it('adds what was done to what was known, newest revision first', () => {
    assert.deepEqual(
      entriesAfterFinish(steps, [done('welcome01'), done('first0001', 2)], [done('first0001', 1)]),
      [done('welcome01'), done('first0001', 2)]
    )
  })
  it('reads as finished when no step was mandatory, even with all of them skipped', () => {
    const optional = [step('maybe0001', { mandatory: false })]
    assert.equal(closingFlowStateOf(optional, entriesAfterFinish(optional, [], [])), 'finished')
  })
})
