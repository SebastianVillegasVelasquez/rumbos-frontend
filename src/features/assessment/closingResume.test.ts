import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { validated } from '../../contracts/openapiExample.ts'
import type { WelcomeStep } from '../course-map/data/types.ts'
import type { ProgressEntry } from '../welcome/flow/flowReducer.ts'
import { closingStepsFor } from './closingJourney.ts'
import {
  closingFlowStateOf,
  closingPlaceOf,
  requiredContentDone,
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
        final: {
          status: final,
          reason,
          attempts: { used: 0, max: 3 },
          percent: null,
          pass_percent: 70,
          pass_operator: 'gt',
        },
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
  it('check-in not passed, content left: the route instructions', () => {
    const locked = status('locked', { reason: 'scorm_incomplete' })
    assert.deepEqual(load(locked, []), { kind: 'route' })
    assert.deepEqual(load(locked, null), { kind: 'route' })
  })
  it('no route instructions without a failed check-in', () => {
    for (const checkin of ['not_taken', 'passed'])
      assert.deepEqual(
        load(status('locked', { reason: 'scorm_incomplete', checkin }), []),
        NONE,
        checkin
      )
  })
  it('closing unavailable for another reason: no prompt at all', () => {
    for (const reason of [
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

describe('a passed check-in on a closing that holds only the final', () => {
  const onlyFinal = [finalStep]
  it('has the congratulations once, then the map: no card and no flow', () => {
    assert.deepEqual(load(passedCheckin, [], [], onlyFinal), screen('congrats_checkin'))
    assert.deepEqual(load(passedCheckin, [], ['congrats_checkin'], onlyFinal), NONE)
  })
  it('does not wait for Moodle, nor read an old record of the final', () => {
    assert.deepEqual(load(passedCheckin, null, [], onlyFinal), screen('congrats_checkin'))
    assert.deepEqual(
      load(passedCheckin, [done('final0001')], ['congrats_checkin'], onlyFinal),
      NONE
    )
  })
  it('still offers the final to a student who must take it', () => {
    assert.deepEqual(load(ready, [], [], onlyFinal), CARD)
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

// The Part 3 states table: with the gate in `observe` mode the server reports the final as
// required and available before anything is done, so the app waits for the check-in and for
// every required visible bubble. In `enforce` the server decides; with the gate `off` there
// is no outcome and nothing changes.
type Gate = 'enforce' | 'observe'
type Checkin = 'not_taken' | 'passed' | 'not_passed' | null

const gated = (gate: Gate, final: string, checkin: Checkin = 'not_passed'): ClosingStatus =>
  parseClosingStatus(
    validated('GET', '/trainer/closing', 200, {
      enforced: gate === 'enforce',
      preview: false,
      available: final === 'required',
      reason:
        final === 'locked' ? 'scorm_incomplete' : final === 'required' ? null : 'already_passed',
      progress: gate === 'enforce' ? { completed: 0, total: 5 } : null,
      final: null,
      outcome: {
        checkin:
          checkin === null
            ? null
            : {
                status: checkin,
                percent: checkin === 'not_taken' ? null : '40.00',
                pass_percent: 70,
                pass_operator: 'gt',
                attempts: { used: checkin === 'not_taken' ? 0 : 1, max: 1 },
              },
        final: {
          status: final,
          reason: final === 'locked' ? 'scorm_incomplete' : null,
          attempts: { used: 0, max: 3 },
          percent: null,
          pass_percent: 70,
          pass_operator: 'gt',
        },
        scorm_gate:
          gate === 'observe'
            ? { satisfied: null, reason: 'not_checked' }
            : { satisfied: final !== 'locked', reason: null },
      },
    })
  )

interface Visit {
  moodle?: ProgressEntry[] | null
  contentDone?: boolean | null
  // Read in an earlier visit, and in this one.
  stored?: JourneyScreen[]
  dismissed?: JourneyScreen[]
}
const visit = (
  value: ClosingStatus | null,
  { moodle = [], contentDone = false, stored = [], dismissed = [] }: Visit = {}
): ClosingPlace =>
  closingPlaceOf({
    status: value,
    flow: closingFlowStateOf(closingStepsFor(steps, value), moodle),
    seen: (name) => stored.includes(name) || dismissed.includes(name),
    dismissed: (name) => dismissed.includes(name),
    contentDone,
  })
const ROUTE: ClosingPlace = { kind: 'route' }

describe('observe: the app waits for the check-in and the content', () => {
  it('reads not_checked from the gate', () => {
    assert.equal(gated('observe', 'required').outcome?.scormGate.reason, 'not_checked')
  })
  it('no attempts yet: nothing, with the content done or not', () => {
    const fresh = gated('observe', 'required', 'not_taken')
    for (const contentDone of [false, true]) assert.deepEqual(visit(fresh, { contentDone }), NONE)
  })
  it('check-in taken, content incomplete: the route, never the card', () => {
    assert.deepEqual(visit(gated('observe', 'required'), { contentDone: false }), ROUTE)
  })
  it('content incomplete: a flow left in the middle does not reopen either', () => {
    const place = visit(gated('observe', 'required'), {
      contentDone: false,
      moodle: [done('first0001')],
    })
    assert.deepEqual(place, ROUTE)
  })
  it('progress not known yet: nothing', () => {
    assert.deepEqual(visit(gated('observe', 'required'), { contentDone: null }), NONE)
  })
  it('content complete: the card', () => {
    assert.deepEqual(visit(gated('observe', 'required'), { contentDone: true }), CARD)
  })
  it('content complete, closing in progress: resumed', () => {
    const place = visit(gated('observe', 'required'), {
      contentDone: true,
      moodle: [done('first0001')],
    })
    assert.deepEqual(place, RESUME)
  })
  it('a map without a check-in waits only for the content', () => {
    const noCheckin = gated('observe', 'required', null)
    assert.deepEqual(visit(noCheckin, { contentDone: false }), NONE)
    assert.deepEqual(visit(noCheckin, { contentDone: true }), CARD)
  })
  it('passed check-in: its congratulations, and never the card', () => {
    const passed = gated('observe', 'not_required_passed_checkin', 'passed')
    for (const contentDone of [false, true]) {
      assert.deepEqual(visit(passed, { contentDone }), screen('congrats_checkin'))
      assert.deepEqual(visit(passed, { contentDone, dismissed: ['congrats_checkin'] }), NONE)
    }
  })
  it('passed check-in, closing not started on a later visit: the congratulations again', () => {
    // With no card, they are the only way into the closing.
    const passed = gated('observe', 'not_required_passed_checkin', 'passed')
    assert.deepEqual(visit(passed, { stored: ['congrats_checkin'] }), screen('congrats_checkin'))
  })
  it('passed check-in, closing in progress or finished: resumed, then nothing', () => {
    const passed = gated('observe', 'not_required_passed_checkin', 'passed')
    const flow = [step('first0001'), step('second001'), finalStep]
    const at = (moodle: ProgressEntry[]) =>
      closingPlaceOf({
        status: passed,
        flow: closingFlowStateOf(closingStepsFor(flow, passed), moodle),
        seen: () => true,
        dismissed: () => false,
        contentDone: false,
      })
    assert.deepEqual(at([done('first0001')]), RESUME)
    assert.deepEqual(at([done('first0001'), done('second001')]), NONE)
  })
  it('passed final: its congratulations once, then nothing', () => {
    const passed = gated('observe', 'passed')
    for (const contentDone of [false, true]) {
      assert.deepEqual(visit(passed, { contentDone }), screen('congrats_final'))
      assert.deepEqual(visit(passed, { contentDone, stored: ['congrats_final'] }), NONE)
    }
  })
  it('attempts spent: the review screen, whatever the content', () => {
    assert.deepEqual(visit(gated('observe', 'exhausted')), screen('exhausted'))
  })
})

describe('enforce: the server decides', () => {
  it('required and available: the card, whatever this app sees of the content', () => {
    for (const contentDone of [false, null, true])
      assert.deepEqual(visit(gated('enforce', 'required'), { contentDone }), CARD)
  })
  it('locked on content: the route, even with every bubble complete on screen', () => {
    assert.deepEqual(visit(gated('enforce', 'locked'), { contentDone: true }), ROUTE)
  })
  it('passed check-in, congratulations read, closing not started: the card, as before', () => {
    const passed = gated('enforce', 'not_required_passed_checkin', 'passed')
    assert.deepEqual(visit(passed, { stored: ['congrats_checkin'] }), CARD)
  })
})

describe('off: no outcome, the behaviour is unchanged', () => {
  it('shows nothing, with the content done or not', () => {
    const off = parseClosingStatus(
      validated('GET', '/trainer/closing', 200, {
        enforced: false,
        preview: false,
        available: true,
        reason: null,
      })
    )
    for (const contentDone of [false, true]) assert.deepEqual(visit(off, { contentDone }), NONE)
  })
})

describe('whether the required content is done', () => {
  it('compares the counts of the map’s progress', () => {
    assert.equal(requiredContentDone({ total: 3, completed: 2 }, true), false)
    assert.equal(requiredContentDone({ total: 3, completed: 3 }, true), true)
    // A map with nothing Moodle tracks has nothing to wait for.
    assert.equal(requiredContentDone({ total: 0, completed: 0 }, true), true)
  })
  it('does not guess before the plugin’s progress is known', () => {
    assert.equal(requiredContentDone({ total: 0, completed: 0 }, false), null)
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
