import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { FLOW_LIMITS, type WelcomeStep } from '../../course-map/data/types.ts'
import { validateFlow } from '../flow/flowSteps.ts'
import {
  STARTER_TEMPLATES,
  addStep,
  applyTemplate,
  askAgain,
  canAdd,
  canMove,
  createStep,
  deleteStep,
  duplicateStep,
  moveStep,
  updateStep,
  type NewStepLabels,
  type TemplateId,
} from './flowEdit.ts'

const labels: NewStepLabels = {
  welcome: 'Bienvenida',
  video: 'Video',
  html: 'Texto',
  pdf: 'Documento',
  quiz: 'Evaluación',
}
let seed = 1
const random = () => {
  seed = (seed * 16807) % 2147483647
  return seed / 2147483647
}
const make = (steps: WelcomeStep[], type: WelcomeStep['type']) =>
  addStep(steps, createStep(type, steps, labels, random))
const flow = (...kinds: WelcomeStep['type'][]) =>
  kinds.reduce<WelcomeStep[]>((steps, type) => make(steps, type), [])
const types = (steps: readonly WelcomeStep[]) => steps.map((step) => step.type)

describe('adding steps', () => {
  it('creates mandatory steps at revision 1 with a valid unique key', () => {
    const steps = flow('welcome', 'video', 'html', 'pdf', 'quiz')
    for (const step of steps) {
      assert.equal(step.mandatory, true)
      assert.equal(step.revision, 1)
      assert.match(step.key, FLOW_LIMITS.keyPattern)
    }
    assert.equal(new Set(steps.map((step) => step.key)).size, 5)
  })
  it('puts a welcome step first and the others last', () => {
    assert.deepEqual(types(flow('video', 'html', 'welcome')), ['welcome', 'video', 'html'])
  })
  it('refuses a second welcome, a fourth quiz and a thirteenth step', () => {
    assert.equal(canAdd(flow('welcome'), 'welcome'), 'welcome_exists')
    assert.equal(canAdd(flow('quiz', 'quiz', 'quiz'), 'quiz'), 'quiz_too_many')
    assert.equal(canAdd(flow(...Array<'html'>(12).fill('html')), 'html'), 'too_many')
    assert.equal(canAdd(flow('html'), 'quiz'), null)
  })
})

describe('moving, duplicating, deleting', () => {
  it('moves a step by one and keeps the welcome step first', () => {
    const steps = flow('welcome', 'video', 'html')
    assert.deepEqual(types(moveStep(steps, 2, -1)), ['welcome', 'html', 'video'])
    assert.equal(canMove(steps, 1, -1), false, 'nothing above the welcome step')
    assert.equal(canMove(steps, 0, 1), false, 'the welcome step does not move')
    assert.equal(canMove(steps, 2, 1), false, 'not past the end')
    assert.deepEqual(types(moveStep(steps, 1, -1)), ['welcome', 'video', 'html'])
  })
  it('duplicates with a new key, a copy title and revision 1', () => {
    const steps = updateStep(flow('html'), 0, { title: 'Reglas', revision: 4 })
    const next = duplicateStep(steps, 0, '(copia)', random)
    assert.equal(next.length, 2)
    assert.notEqual(next[1].key, next[0].key)
    assert.equal(next[1].title, 'Reglas (copia)')
    assert.equal(next[1].revision, 1)
  })
  it('does not duplicate a welcome step or past a limit', () => {
    assert.equal(duplicateStep(flow('welcome'), 0, 'x').length, 1)
    assert.equal(duplicateStep(flow('quiz', 'quiz', 'quiz'), 0, 'x').length, 3)
  })
  it('deletes by position', () => {
    assert.deepEqual(types(deleteStep(flow('welcome', 'video', 'html'), 1)), ['welcome', 'html'])
  })
})

describe('changing a step', () => {
  it('never changes the key or the type, whatever the patch says', () => {
    const steps = flow('html')
    const next = updateStep(steps, 0, { key: 'otherkey12', type: 'video', title: 'T' } as never)
    assert.equal(next[0].key, steps[0].key)
    assert.equal(next[0].type, 'html')
    assert.equal(next[0].title, 'T')
  })
  it('asking again raises the revision, up to the limit', () => {
    const steps = flow('html')
    assert.equal(askAgain(steps, 0)[0].revision, 2)
    const top = updateStep(steps, 0, { revision: 1_000_000 })
    assert.equal(askAgain(top, 0)[0].revision, 1_000_000)
  })
})

describe('the starter templates', () => {
  for (const id of Object.keys(STARTER_TEMPLATES) as TemplateId[]) {
    it(`"${id}" passes the same validation as anything the author writes`, () => {
      const base = flow('html')[0]
      assert.equal(base.type, 'html')
      if (base.type !== 'html') return
      const step = applyTemplate({ ...base, title: 'Reglas' }, id)
      const problems = validateFlow({
        enabled: true,
        title: null,
        message: null,
        video: null,
        playOnEnter: true,
        show: 'first_visit',
        steps: [step],
      })
      assert.deepEqual(problems, [])
    })
  }
})
