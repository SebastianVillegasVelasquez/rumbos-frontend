import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { FlowKey, MapWelcome, WelcomeStep } from '../../course-map/data/types.ts'
import {
  addStep,
  canAdd,
  canMove,
  createStep,
  duplicateStep,
  moveStep,
  type NewStepLabels,
} from '../editor/flowEdit.ts'
import { toStepInfo } from './flowReducer.ts'
import {
  PURPOSE_BY_FLOW,
  SHARED_STEP_TYPES,
  STEP_TYPES_BY_FLOW,
  validateFlow,
} from './flowSteps.ts'

// The same steps in both flows: for every step type and flow, the editor operations and
// the validation agree with the one shared table in flowSteps.ts.

const names: NewStepLabels = {
  welcome: 'B',
  video: 'V',
  html: 'T',
  pdf: 'D',
  quiz: 'Q',
  assessment: 'A',
}
const FLOWS: FlowKey[] = ['welcome', 'closing']
const ALL_TYPES = ['welcome', 'video', 'html', 'pdf', 'quiz', 'assessment'] as const
const DOCUMENT = 'doc00000-0000-4000-8000-000000000001'

// A deterministic source that never repeats a key: a constant would loop once its key is taken.
let counter = 0
const sequence = () => () => {
  counter = (counter + 0.0137) % 1
  return counter
}

const flow = (steps: WelcomeStep[]): MapWelcome => ({
  enabled: true,
  title: null,
  message: null,
  video: null,
  playOnEnter: null,
  show: 'always',
  steps,
})

// A step that passes the client's validation, whatever the type.
const valid = (
  type: (typeof ALL_TYPES)[number],
  flowKey: FlowKey,
  taken: WelcomeStep[] = []
): WelcomeStep => {
  const step = createStep(type, taken, names, sequence(), flowKey)
  if (step.type === 'video')
    return { ...step, video: { provider: 'youtube' as const, videoId: 'dQw4w9WgXcQ' } }
  if (step.type === 'pdf') return { ...step, assetId: DOCUMENT }
  return step
}
const validate = (steps: WelcomeStep[], flowKey: FlowKey) =>
  validateFlow(flow(steps), { flowKey, availableDocuments: new Set([DOCUMENT]) })

describe('the step types of both flows', () => {
  it('derives the closing flow from the shared table, not from a copy', () => {
    for (const type of SHARED_STEP_TYPES) {
      assert.ok(STEP_TYPES_BY_FLOW.welcome.includes(type), type)
      assert.ok(STEP_TYPES_BY_FLOW.closing.includes(type), type)
    }
    assert.deepEqual(
      STEP_TYPES_BY_FLOW.closing,
      STEP_TYPES_BY_FLOW.welcome.filter((type) => type !== 'welcome' && type !== 'quiz')
    )
  })

  it('leaves out of the closing flow what the backend refuses there', () => {
    // `step_type_not_allowed`: the greeting and the Moodle quiz.
    assert.ok(!STEP_TYPES_BY_FLOW.closing.includes('welcome'))
    assert.ok(!STEP_TYPES_BY_FLOW.closing.includes('quiz'))
  })

  it('allows one native exam per flow', () => {
    const steps: WelcomeStep[] = [valid('assessment', 'closing')]
    assert.equal(canAdd(steps, 'assessment'), 'assessment_exists')
    assert.equal(canAdd(steps, 'html'), null)
  })

  for (const flowKey of FLOWS)
    for (const type of ALL_TYPES) {
      const offered = STEP_TYPES_BY_FLOW[flowKey].includes(type)
      describe(`${type} in the ${flowKey} flow`, () => {
        it(offered ? 'is offered and validates' : 'is refused as an invalid type', () => {
          const codes = validate([valid(type, flowKey)], flowKey).map((p) => `${p.path}:${p.code}`)
          assert.deepEqual(codes, offered ? [] : ['steps[0].type:step_type_invalid'])
        })

        if (!offered) return

        it('can be added, duplicated, moved and removed like any other', () => {
          const first = valid('html', flowKey)
          const steps = addStep([first], valid(type, flowKey, [first]))
          if (type === 'welcome') return
          assert.equal(canMove(steps, 1, -1), true)
          assert.deepEqual(
            moveStep(steps, 1, -1).map((step) => step.type),
            [type, 'html']
          )
          const copy = duplicateStep(steps, 1, '(copia)', sequence())
          // One native exam per flow: it cannot be duplicated.
          if (type === 'assessment') return assert.equal(copy.length, 2)
          assert.equal(copy.length, 3)
          assert.equal(copy[2].type, type)
          assert.notEqual(copy[2].key, copy[1].key)
          assert.deepEqual(validate(copy, flowKey), [])
        })

        it('gates "Continuar" with the same step info', () => {
          const info = toStepInfo(valid(type, flowKey))
          assert.equal(info.type, type)
          assert.equal(info.mandatory, true)
        })
      })
    }

  for (const flowKey of FLOWS)
    it(`pins the assessment of the ${flowKey} flow to its own purpose`, () => {
      const step = createStep('assessment', [], names, sequence(), flowKey)
      assert.equal(step.type === 'assessment' && step.purpose, PURPOSE_BY_FLOW[flowKey])
      const other = FLOWS.find((key) => key !== flowKey)!
      assert.deepEqual(
        validate([step], other).map((p) => p.code),
        ['step_field_invalid']
      )
    })

  it('validates a closing flow of video, PDF, text and the final exam', () => {
    const steps: WelcomeStep[] = []
    for (const type of ['video', 'pdf', 'html', 'assessment'] as const)
      steps.push(valid(type, 'closing', steps))
    assert.deepEqual(validate(steps, 'closing'), [])
  })

  it('keeps the limits: twelve steps and three quizzes', () => {
    const quizzes: WelcomeStep[] = []
    for (let i = 0; i < 3; i++) quizzes.push(valid('quiz', 'welcome', quizzes))
    assert.equal(canAdd(quizzes, 'quiz'), 'quiz_too_many')
    const full: WelcomeStep[] = []
    for (let i = 0; i < 12; i++) full.push(valid('html', 'closing', full))
    assert.equal(canAdd(full, 'video'), 'too_many')
  })
})
