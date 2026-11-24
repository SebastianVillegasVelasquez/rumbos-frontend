import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { AppearanceUpdate, MapWelcome } from '../../course-map/data/types.ts'
import { addStep, createStep, moveStep } from '../editor/flowEdit.ts'
import { serializeAppearance } from '../welcomeWire.ts'
import { validateFlow } from './flowSteps.ts'

const names = { welcome: 'B', video: 'V', html: 'T', pdf: 'D', quiz: 'Q', assessment: 'A' }
const closing = (steps: MapWelcome['steps']): MapWelcome => ({
  enabled: true,
  title: null,
  message: null,
  video: null,
  playOnEnter: null,
  show: 'always',
  steps,
})
const html = createStep('html', [], names, () => 0.1, 'closing')
const final = createStep('assessment', [html], names, () => 0.5, 'closing')

describe('the closing flow', () => {
  it('creates the final exam, not the check-in', () => {
    assert.equal(final.type === 'assessment' && final.purpose, 'final')
    const welcomeSide = createStep('assessment', [], names, () => 0.2)
    assert.equal(welcomeSide.type === 'assessment' && welcomeSide.purpose, 'check_in')
  })

  it('accepts authored content and the final exam, in any order', () => {
    const steps = moveStep(addStep([html], final), 1, -1)
    assert.deepEqual(validateFlow(closing(steps), { flowKey: 'closing' }), [])
  })

  it('refuses the check-in and the greeting, which belongs to the welcome flow', () => {
    const checkIn = createStep('assessment', [], names, () => 0.3)
    const codes = (steps: MapWelcome['steps']) =>
      validateFlow(closing(steps), { flowKey: 'closing' }).map((p) => `${p.path}:${p.code}`)
    assert.deepEqual(codes([checkIn]), ['steps[0].purpose:step_field_invalid'])
    assert.ok(
      codes([createStep('welcome', [], names, () => 0.4)]).includes(
        'steps[0].type:step_type_invalid'
      )
    )
  })

  it('keeps the welcome flow refusing the final exam', () => {
    assert.deepEqual(
      validateFlow(closing([final])).map((p) => p.code),
      ['step_field_invalid']
    )
  })

  it('is never sent to the backend, which would answer 422 extra_forbidden', () => {
    const body = {
      settings: { closing: closing([html]), welcome: closing([html]) },
      defaultSkinId: null,
      skinRules: [],
    } as unknown as AppearanceUpdate
    const sent = JSON.parse(JSON.stringify(serializeAppearance(body)))
    assert.equal('closing' in sent.settings, false)
    assert.ok(sent.settings.welcome)
  })
})
